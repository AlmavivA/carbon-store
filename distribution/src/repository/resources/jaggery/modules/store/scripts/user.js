var user = {};
(function (server, user) {

    var USER_REGISTRY = 'server.user.registry';

    var USER_SPACE = 'server.user.space';

    var USER_ROLE_PREFIX = 'Internal/private_';


    var privateRole = function (username) {
        return USER_ROLE_PREFIX + cleanUsername(username);
    };

    var cleanUsername = function (username) {
        return username.replace('@', ':');
    };

    user.USER_OPTIONS = 'server.user.options';

    /**
     * Initializes the user environment for the specified tenant. If it is already initialized, then will be skipped.
     */
    user.init = function (options) {
        var event = require('event');
        event.on('tenantCreate', function (tenantId) {
            var role, roles,
                um = server.userManager(tenantId),
                options = server.options();
            roles = options.roles;
            for (role in roles) {
                if (roles.hasOwnProperty(role)) {
                    if (um.roleExists(role)) {
                        um.authorizeRole(role, roles[role]);
                    } else {
                        um.addRole(role, [], roles[role]);
                    }
                }
            }
            /*user = um.getUser(options.user.username);
             if (!user.hasRoles(options.userRoles)) {
             user.addRoles(options.userRoles);
             }*/
            //application.put(key, options);
        });

        event.on('tenantLoad', function (tenantId) {

        });

        event.on('tenantUnload', function (tenantId) {

        });

        event.on('login', function (tenantId, usr, session) {
            var space,
                carbon = require('carbon');
            server.current(session, usr);
            session.put(USER_REGISTRY, new carbon.registry.Registry(server.instance(), {
                username: usr.username,
                tenantId: tenantId
            }));
            space = user.userSpace(usr);
            session.put(USER_SPACE, space);
            if (!usr.isAuthorized(space, carbon.registry.actions.PUT)) {
                emit('userRegister', tenantId, usr);
            }
        });

        event.on('logout', function (tenantId, usr, session) {
            server.current(session, null);
            session.remove(USER_SPACE);
            session.remove(USER_REGISTRY);
        });

        event.on('userRegister', function (tenantId, usr) {
            var role, perms, r, p,
                log = new Log(),
                carbon = require('carbon'),
                event = require('event'),
                um = server.userManager(usr.tenantId),
                opts = server.options(usr.tenantId),
                space = user.userSpace(usr),
                registry = server.systemRegistry(tenantId);
            if (!registry.exists(space)) {
                registry.put(space, {
                    collection: true
                });
                if (log.isDebugEnabled()) {
                    log.debug('user space was created for user : ' + usr.username + ' at ' + space);
                }
            }
            role = privateRole(usr.username);
            perms = {};
            perms[space] = [
                carbon.registry.actions.GET,
                carbon.registry.actions.PUT,
                carbon.registry.actions.DELETE,
                carbon.registry.actions.AUTHORIZE
            ];
            p = opts.permissions.login;
            for (r in p) {
                if (p.hasOwnProperty(r)) {
                    perms[r] = p[r];
                }
            }
            if (!um.roleExists(role)) {
                um.addRole(role, [], perms);
            }
            if (usr.hasRoles[role]) {
                usr.addRoles([role]);
            }
            um.authorizeRole(privateRole(usr.username), perms);
            if (log.isDebugEnabled()) {
                log.debug('user ' + usr.username + ' was initialized and role ' + role +
                    ' was authorized to access user space ' + space);
            }
        });
    };

    /**
     * Returns user options of the tenant.
     * @return {Object}
     */
    user.options = function (tenantId) {
        return server.configs(tenantId)[user.USER_OPTIONS];
    };

    /**
     * Logs in a user to the store. Username might contains the domain part in case of MT mode.
     * @param username ruchira or ruchira@ruchira.com
     * @param password
     * @param session
     * @return {boolean}
     */
    user.login = function (username, password, session) {
        var carbon = require('carbon'),
            event = require('event'),
            serv = server.instance();
        if (!serv.authenticate(username, password)) {
            return false;
        }
        return user.permitted(username, session);
    };

    user.permitted = function (username, session) {
        //load the tenant if it hasn't been loaded yet.
        var opts, um, perms, perm, actions, length, i,
            authorized = false,
            carbon = require('carbon'),
            event = require('event'),
            usr = carbon.server.tenantUser(username);
        if (!server.configs(usr.tenantId)) {
            event.emit('tenantCreate', usr.tenantId);
        }
        if (!server.configs(usr.tenantId)[user.USER_OPTIONS]) {
            event.emit('tenantLoad', usr.tenantId);
        }

        opts = user.options(usr.tenantId);
        um = server.userManager(usr.tenantId);
        usr = um.getUser(usr.username);
        usr.tenantDomain = carbon.server.tenantDomain({tenantId: usr.tenantId});
        perms = opts.permissions.login;
        L1:
            for (perm in perms) {
                if (perms.hasOwnProperty(perm)) {
                    actions = perms[perm];
                    length = actions.length;
                    for (i = 0; i < length; i++) {
                        if (usr.isAuthorized(perm, actions[i])) {
                            authorized = true;
                            break L1;
                        }
                    }
                }
            }
        if (!authorized) {
            return false;
        }
        event.emit('login', usr.tenantId, usr, session);
        return true;
    };

    /**
     * Checks whether the logged in user has permission to the specified action.
     * @param user
     * @param permission
     * @param action
     * @return {*}
     */
    user.isAuthorized = function (user, permission, action) {
        var um = server.userManager(user.tenantId);
        return um.getUser(user.username).isAuthorized(permission, action);
    };

    /**
     * Returns the user's registry space. This should be called once with the username,
     * then can be called without the username.
     * @param user user object
     * @return {*}
     */
    user.userSpace = function (user) {
        try {
            return server.configs(user.tenantId).userSpace + '/' + cleanUsername(user.username);
        } catch (e) {
            return null;
        }
    };

    /**
     * Get the registry instance belongs to logged in user.
     * @return {*}
     */
    user.userRegistry = function (session) {
        try {
            return session.get(USER_REGISTRY);
        } catch (e) {
            return null;
        }
    };

    /**
     * Logs out the currently logged in user.
     */
    user.logout = function () {
        var usr = server.current(session),
            event = require('event'),
            opts = server.options(usr.tenantId);
        if (opts.logout) {
            opts.logout(usr, session);
        }
        event.emit('logout', usr.tenantId, usr, session);
    };

    /**
     * Checks whether the specified username already exists.
     * @param username ruchira@ruchira.com(multi-tenanted) or ruchira
     * @return {*}
     */
    user.userExists = function (username) {
        var carbon = require('carbon'),
            usr = carbon.server.tenantUser(username);
        return server.userManager(usr.tenantId).userExists(usr.username);
    };

    user.register = function (username, password) {
        var carbon = require('carbon'),
            event = require('event'),
            usr = carbon.server.tenantUser(username),
            um = server.userManager(usr.tenantId);

        if (!server.configs(usr.tenantId)) {
            event.emit('tenantCreate', usr.tenantId);
        }
        if (!server.configs(usr.tenantId)[user.USER_OPTIONS]) {
            event.emit('tenantLoad', usr.tenantId);
        }

        var opts = server.options(usr.tenantId);

        um.addUser(usr.username, password, opts.userRoles);
        usr = um.getUser(usr.username);
        event.emit('userRegister', usr.tenantId, usr);
        //login(username, password);
    };

    user.loginWithSAML = function (username) {
        return user.permitted(username, session);
    };
}(server, user));
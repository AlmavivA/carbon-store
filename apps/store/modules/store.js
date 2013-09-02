var ASSETS_EXT_PATH = '/assets/';

var ASSET_MANAGERS = 'asset.managers';

var TENANT_STORE = 'tenant.store';

var STORE_CONFIG_PATH = '/_system/config/store/configs/store.json';

var TAGS_QUERY_PATH = '/_system/config/repository/components/org.wso2.carbon.registry/queries/allTags';

//TODO: read from tenant config
var ASSETS_PAGE_SIZE = 'assetsPageSize';

//TODO: read from tenant config
var COMMENTS_PAGE_SIZE = 'commentsPageSize';

var log = new Log();

var merge = function (def, options) {
    if (options) {
        for (var op in def) {
            if (def.hasOwnProperty(op)) {
                def[op] = options[op] || def[op];
            }
        }
    }
    return def;
};

var init = function (options) {
    //addRxtConfigs(tenantId);
    var event = require('/modules/event.js');

    event.on('tenantCreate', function (tenantId) {
        var carbon = require('carbon'),
            config = require('/store-tenant.json'),
            server = require('/modules/server.js'),
            system = server.systemRegistry(tenantId);
        //um = server.userManager(tenantId),
        //GovernanceConstants = org.wso2.carbon.governance.api.util.GovernanceConstants;
        system.put(STORE_CONFIG_PATH, {
            content: JSON.stringify(config),
            mediaType: 'application/json'
        });
        system.put(TAGS_QUERY_PATH, {
            content: 'SELECT RT.REG_TAG_ID FROM REG_RESOURCE_TAG RT ORDER BY RT.REG_TAG_ID',
            mediaType: 'application/vnd.sql.query',
            properties: {
                resultType: 'Tags'
            }
        });
        //um.authorizeRole(carbon.user.anonRole, GovernanceConstants.RXT_CONFIGS_PATH, carbon.registry.actions.GET);
    });

    event.on('tenantLoad', function (tenantId) {
        var user = require('/modules/user.js'),
            server = require('/modules/server.js'),
            carbon = require('carbon'),
            config = server.configs(tenantId),
            CommonUtil = Packages.org.wso2.carbon.governance.registry.extensions.utils.CommonUtil,
            GovernanceConstants = org.wso2.carbon.governance.api.util.GovernanceConstants,
            reg = server.systemRegistry(tenantId),
            um = server.userManager(tenantId);

        //check whether tenantCreate has been called
        if (!reg.exists(STORE_CONFIG_PATH)) {
            event.emit('tenantCreate', tenantId);
        }

        CommonUtil.addRxtConfigs(reg.registry.getChrootedRegistry("/_system/governance"), reg.tenantId);
        um.authorizeRole(carbon.user.anonRole, GovernanceConstants.RXT_CONFIGS_PATH, carbon.registry.actions.GET);
        config[user.USER_OPTIONS] = configs(tenantId);

        config[TENANT_STORE] = new Store(tenantId);
    });

    event.on('login', function (tenantId, user, session) {
        var server = require('/modules/server.js'),
            assetManagers = {};
        store(tenantId).assetTypes().forEach(function (type) {
            var path = ASSETS_EXT_PATH + type + '/asset.js',
                azzet = new File(path).isExists() ? require(path) : require('/modules/asset.js');
            assetManagers[type] = new azzet.Manager(server.anonRegistry(tenantId), type);
        });
        session[ASSET_MANAGERS] = assetManagers;
    });
};

//TODO:
var currentAsset = function () {
    var prefix = require('/store.js').config().assetsUrlPrefix, matcher = new URIMatcher(request.getRequestURI());
    if (matcher.match('/{context}' + prefix + '/{type}/{+any}') || matcher.match('/{context}' + prefix + '/{type}')) {
        return matcher.elements().type;
    }
    prefix = require('/store.js').config().assetUrlPrefix;
    if (matcher.match('/{context}' + prefix + '/{type}/{+any}') || matcher.match('/{context}' + prefix + '/{type}')) {
        return matcher.elements().type;
    }
    return null;
};

var store = function (tenantId) {
    var store, configs, server;
    //user = require('/modules/user.js');
    /*    if(user.current()) {
     store = session.get(TENANT_STORE);
     if(store) {
     return store;
     }
     store = new Store(tenantId);
     session.put(TENANT_STORE, store);
     return store;
     }*/
    server = require('/modules/server.js');
    configs = server.configs(tenantId);
    store = configs[TENANT_STORE];
    if (store) {
        return store;
    }
    store = new Store(tenantId);
    configs[TENANT_STORE] = store;
    return store;
};

var assetManager = function (type, reg) {
    var path = ASSETS_EXT_PATH + type + '/asset.js',
        azzet = new File(path).isExists() ? require(path) : require('/modules/asset.js');
    return new azzet.Manager(reg, type);
};

var configs = function (tenantId) {
    var server = require('/modules/server.js'),
        registry = server.systemRegistry(tenantId);
    return JSON.parse(registry.content(STORE_CONFIG_PATH));
};

//TODO: Remove requiring asset.js, server.js and user.js in multiple places
var Store = function (tenantId) {
    this.tenantId = tenantId;
    var assetManagers = {};
    configs(tenantId).assets.forEach(function (type) {
        var path = ASSETS_EXT_PATH + type + '/asset.js',
            azzet = new File(path).isExists() ? require(path) : require('/modules/asset.js');
        assetManagers[type] = new azzet.Manager(server.anonRegistry(tenantId), type);
    });
    this.assetManagers = assetManagers;
    this.usrmod = require('/modules/user.js');
    this.servmod = require('/modules/server.js');
};

Store.prototype.assetManager = function (type) {
    var manager, assetManagers,
        path = ASSETS_EXT_PATH + type + '/asset.js',
        azzet = new File(path).isExists() ? require(path) : require('/modules/asset.js');
    if (this.usrmod.current()) {
        assetManagers = session.get(ASSET_MANAGERS);
        if (!assetManagers) {
            assetManagers = {};
            session.put(ASSET_MANAGERS, assetManagers);
        }
        manager = assetManagers[type];
        if (manager) {
            return manager;
        }
        return (assetManagers[type] = new azzet.Manager(this.usrmod.userRegistry(), type));
    }
    return this.assetManagers[type];
};

Store.prototype.assetsPageSize = function() {
    return configs()[ASSETS_PAGE_SIZE];
};

Store.prototype.commentsPageSize = function() {
    return configs()[COMMENTS_PAGE_SIZE];
};

Store.prototype.assetsPaging = function (request) {
    var page = request.getParameter('page'),
        size = this.assetsPageSize();
    page = page ? page - 1 : 0;
    return {
        start: page * size,
        count: size,
        sort: request.getParameter('sort') || 'recent'
    };
};

Store.prototype.commentsPaging = function (request) {
    var page = request.getParameter('page'),
        size = this.commentsPageSize();
    page = page ? page - 1 : 0;
    return {
        start: page * size,
        count: size,
        sort: request.getParameter('sort') || 'recent'
    };
};

Store.prototype.userAssets = function (user) {
    var items = [],
        registry = this.usrmod.userRegistry(),
        path = this.usrmod.userSpace(user.username) + '/userAssets',
        assets = registry.get(path),
        assetz = {};
    if (!assets || assets.length <= 0) {
        return assetz;
    }
    assets.forEach(function (type) {
        var obj = registry.get(path + '/' + type);
        obj.forEach(function (id) {
            items.push(asset(type, id))
        });
        assetz[type] = items;
    });
    return assetz;
};

Store.prototype.configs = function () {
    return configs(this.tenantId);
};

/**
 * Returns all tags
 * @param type Asset type
 */
Store.prototype.tags = function (type) {
    var tag, tags, assetType, i, length, count,
        registry = this.usrmod.userRegistry() || this.servmod.anonRegistry(this.tenantId),
        tagz = [],
        tz = {};
    tags = registry.query(TAGS_QUERY_PATH);
    length = tags.length;
    if (type == undefined) {
        for (i = 0; i < length; i++) {
            tag = tags[i].split(';')[1].split(':')[1];
            count = tz[tag];
            count = count ? count + 1 : 1;
            tz[tag] = count;
        }
    } else {
        for (i = 0; i < length; i++) {
            assetType = tags[i].split(';')[0].split('/')[3];
            if (assetType != undefined) {
                if (assetType.contains(type)) {
                    tag = tags[i].split(';')[1].split(':')[1];
                    count = tz[tag];
                    count = count ? count + 1 : 1;
                    tz[tag] = count;
                }
            }
        }
    }
    for (tag in tz) {
        if (tz.hasOwnProperty(tag)) {
            var result = this.assetManager(type).checkTagAssets({tag: tag });
            if (result.length > 0) {
                tagz.push({
                    name: String(tag),
                    count: tz[tag]
                });
            }
        }
    }
    return tagz;
};

Store.prototype.comments = function (aid, paging) {
    var registry = this.usrmod.userRegistry() || this.servmod.anonRegistry(this.tenantId);
    return registry.comments(aid, paging);
};

Store.prototype.commentCount = function (aid) {
    var registry = this.usrmod.userRegistry() || this.servmod.anonRegistry(this.tenantId);
    return registry.commentCount(aid);
};

Store.prototype.comment = function (aid, comment) {
    var registry = this.usrmod.userRegistry() || this.servmod.anonRegistry(this.tenantId);
    return registry.comment(aid, comment);
};

Store.prototype.rating = function (aid) {
    var username, registry,
        carbon = require('carbon'),
        usr = this.usrmod.current();
    if (usr) {
        registry = this.usrmod.userRegistry();
        username = usr.username;
    } else {
        registry = this.servmod.anonRegistry(this.tenantId);
        username = carbon.user.anonUser;
    }
    return registry.rating(aid, username);
};

Store.prototype.rate = function (aid, rating) {
    var registry = this.usrmod.userRegistry() || this.servmod.anonRegistry(this.tenantId);
    return registry.rate(aid, rating);
};

/**
 * Returns all assets for the current user
 * @param type Asset type
 * @param paging
 */
Store.prototype.assets = function (type, paging) {
    var i,
        assetz = this.assetManager(type).list(paging);
    for (i = 0; i < assetz.length; i++) {
        assetz[i].indashboard = this.isuserasset(assetz[i].id, type);
    }
    return assetz;
};

Store.prototype.tagged = function (type, tag, paging) {
    var i,
        options = {
            tag: tag,
            attributes: {
                'overview_status': /^(published)$/i
            }
        },
        assets = this.assetManager(type).search(options, paging),
        length = assets.length;
    for (i = 0; i < length; i++) {
        assets[i].rating = this.rating(assets[i].id);
        assets[i].indashboard = this.isuserasset(assets[i].id, type);
    }
    return assets;
};

/**
 * Returns asset data for the current user
 * @param type Asset type
 * @param aid Asset identifier
 */
Store.prototype.asset = function (type, aid) {
    var asset = this.assetManager(type).get(aid);
    asset.rating = this.rating(aid);
    return asset;
};

/**
 * Returns links of a asset for the current user
 * @param type Asset type
 */
Store.prototype.assetLinks = function (type) {
    var mod = require(ASSETS_EXT_PATH + type + '/asset.js');
    return mod.assetLinks(user.current());
};

/**
 * @param type
 * @param count
 * @return {*}
 */
Store.prototype.popularAssets = function (type, count) {
    return this.assetManager(type).list({
        start: 0,
        count: count || 5,
        sort: 'popular'
    });
};

Store.prototype.recentAssets = function (type, count) {
    var i, length;

    var recent = this.assetManager(type).list({
        start: 0,
        count: count || 5,
        sort: 'recent'
    });
    length = recent.length;
    for (i = 0; i < length; i++) {
        recent[i].rating = this.rating(recent[i].id).average;
        recent[i].indashboard = this.isuserasset(recent[i].id, type);
    }
    return recent;
};

Store.prototype.assetCount = function (type, options) {
    return this.assetManager(type).count(options);
};

/**
 * Returns all enabled asset types for the current user
 */
    //TODO
Store.prototype.assetTypes = function () {
    return this.configs().assets;
};

//TODO:
Store.prototype.cache = function (type, key, value) {
    var cache = require('/modules/cache.js'), data = cache.cached(type) || (cache.cache(type, {}));
    return (data[key] = value);
};

//TODO:
Store.prototype.cached = function (type, key) {
    var cache = require('/modules/cache.js'), data = cache.cached(type);
    return data ? data[key] : null;
};

//TODO:
Store.prototype.invalidate = function (type, key) {
    var cache = require('/modules/cache.js'), data = cache.cached(type);
    delete data[key];
};

Store.prototype.search = function (options, paging) {
    var i, length, types, assets,
        type = options.type,
        attributes = options.attributes || (options.attributes = {});
    //adding status field to get only the published assets
    attributes['overview_status'] = /^(published)$/i;
    if (type) {
        var assetz = this.assetManager(type).search(options, paging);
        for (i = 0; i < assetz.length; i++) {
            assetz[i].indashboard = this.isuserasset(assetz[i].id, type);
        }
        return assetz;
    }
    types = this.assetTypes();
    assets = {};
    length = types.length;
    for (i = 0; i < length; i++) {
        type = types[i];
        assets[type] = this.assetManager(types[i]).search(options, paging);
    }
    return assets;
};

//TODO: check the logic
Store.prototype.isuserasset = function (aid, type) {
    var j,
        user = this.usrmod.current(),
        userown = {};
    if (!user) {
        return false;
    }
    var userAssets = this.userAssets(user);
    if (!userAssets[type]) {
        return false;
    }
    for (j = 0; j < userAssets[type].length; j++) {
        if (userAssets[type][j]['id'] == aid) {
            userown = userAssets[type][j]['id'];
        }
    }
    return userown.length > 0;
};

Store.prototype.addAsset = function (type, options) {
    this.assetManager(type).add(options);
};

Store.prototype.updateAsset = function (type, options) {
    this.assetManager(type).update(options);
};

Store.prototype.removeAsset = function (type, options) {
    this.assetManager(type).remove(options);
};
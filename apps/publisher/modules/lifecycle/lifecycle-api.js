/*
 * Copyright (c) WSO2 Inc. (http://wso2.com) All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var api = {};
var error = '';
(function(api) {
    var log = new Log('lifecycle_api');
    var rxtModule = require('rxt');
    var storeModule = require('store');
    var lifecycleModule = require('lifecycle');
    var utils = require('utils');
    var exceptionModule = utils.exception;
    var constants = rxtModule.constants;
    /**
     * Function to get asset by id
     * @param options  Object contains asset-id
     * @param am       The asset-manager instance
     */
    var getAsset = function(options, am) {
        try {
            asset = am.get(options.id);
        } catch (e) {
            var asset;
            var msg = 'Unable to locate the asset with id: ' + options.id;
            log.error(msg);
            if (log.isDebugEnabled()) {
                log.debug(e);
            }
            throw exceptionModule.buildExceptionObject(msg, constants.STATUS_CODES.NOT_FOUND);
        }
        return asset;
    };
    /**
     * Validate asset type
     * @param  options Object contains asset type
     */
    var validateOptions = function(options) {
        if (!options.type) {
            var error = 'Unable to obtain state information without knowing the type of asset of id: ' + options.id;
            log.error(error);
            throw exceptionModule.buildExceptionObject(error, constants.STATUS_CODES.BAD_REQUEST);
        }
    };
    /**
     * Validate asset by id, check whether a asset is available by id
     * @param  asset   The asset object
     * @param  options Object contains asset-id
     */
    var validateAsset = function(asset, options) {
        var error = null;
        if (!asset) {
            error = 'Unable to locate asset information of ' + options.id;
        } else if (!asset.lifecycle) {
            error = 'The asset ' + options.id + ' does not have an associated lifecycle';
        } else if (!asset.lifecycleState) {
            error = 'The asset ' + options.id + ' does not have a lifecycle state.';
        }
        if (error) {
            throw exceptionModule.buildExceptionObject(error, constants.STATUS_CODES.NOT_FOUND);
        }
    };
    /**
     * Determines the lifecycle to be used based on the options
     * provided by the user.If the lifecycle query parameter is
     * not found then it is picked up from the asset
     * @param  {Object} options  An options object containing data provided by the user
     * @param  {Object} asset    An asset instance
     * @return {String}         The name of the lifecycle
     */
    var resolveLifecycle = function(options, asset) {
        if (options.lifecycle) {
            return options.lifecycle;
        }
        return asset.lifecycle;
    };
    /**
     * change the state of an asset
     * @param  options  Object contains asset-id
     * @param  req      jaggery request
     * @param  res      jaggery response
     * @param  session  SessionId
     * @return Boolean whether state changed/not
     */
    api.changeState = function(options, req, res, session) {
        var success = false;
        validateOptions(options);
        if (!options.nextState) {
            error = 'A next state has not been provided';
            throw exceptionModule.buildExceptionObject(error, constants.STATUS_CODES.BAD_REQUEST)
        }
        //Obtain the tenantId
        var server = storeModule.server;
        var assetM = rxtModule.asset;
        var user = server.current(session); //get current user
        var tenantId = user.tenantId; //get tenant
        var am = assetM.createUserAssetManager(session, options.type); //get asset manager
        var asset = getAsset(options, am); //get asset
        var lcName = resolveLifecycle(options, asset);
        validateAsset(asset, options); //validate asset
        //Obtain the lifecycle
        var lcApi = lifecycleModule.api;
        var lcState = am.getLifecycleState(asset,lcName);
        var lifecycle = lcApi.getLifecycle(lcName, tenantId); //get lifecycle bind with asset
        log.info(':: change state ::');
        log.info('lc name: '+lcName);
        log.info('next state: '+options.nextState);
        var action = lifecycle.transitionAction(lcState,options.nextState);

        //check whether a transition action available from asset.lifecycleState to options.nextState
        if (!action) {
            error = 'It is not possible to reach ' + options.nextState + ' from ' + lcName;
            throw exceptionModule.buildExceptionObject(error, constants.STATUS_CODES.BAD_REQUEST)
        }
        try {
            log.info('invoking action');
            success = am.invokeLcAction(asset, action, lcName);
            log.info('finished invoking');
        } catch (e) {
            error = 'Error while changing state to ' + options.nextState + ' from ' + lcName;
            if (log.isDebugEnabled()) {
                log.debug(e);
            }
            throw exceptionModule.buildExceptionObject(error, constants.STATUS_CODES.INTERNAL_SERVER_ERROR);
        }
        log.info(':: left change state ::');
        return success;
    };
    /**
     * The method to invoke state transition and check-items state changes
     * @param   options Object contains asset-id
     * @param   req      jaggery request
     * @param   res      jaggery response
     * @param   session  SessionId
     * @return {string}
     */
    api.invokeStateTransition = function(options, req, res, session) {
        var stateReq = req.getAllParameters('UTF-8');
        var successChecking = false;
        var successStateChange = false;
        var msg = '';
        if (!stateReq.checkItems && !stateReq.nextState) {
            var error = 'Checklist items or next state is not provided!';
            throw exceptionModule.buildExceptionObject(error, constants.STATUS_CODES.BAD_REQUEST);
        }
        if (stateReq.checkItems) {
            options.checkItems = JSON.parse(stateReq.checkItems);
            successChecking = this.checkItems(options, req, res, session);
            if (successChecking) {
                msg = 'Checklist items checked successfully! ';
            } else {
                msg = 'Checklist items checking failed! ';
            }
        }
        if (stateReq.nextState) {
            var isCommentsEnabled = true; //TODO load from asset.js
            if (isCommentsEnabled) {
                if (stateReq.comment) {
                    options.comment = stateReq.comment;
                } else {
                    msg = msg + ' Please provide a comment for this state transition!';
                    throw exceptionModule.buildExceptionObject(msg, constants.STATUS_CODES.BAD_REQUEST);
                }
            }
            options.nextState = stateReq.nextState;
            successStateChange = this.changeState(options, req, res, session);
            if (successStateChange) {
                msg = msg + ' State changed successfully to ' + options.nextState + '!';
            } else {
                msg = msg + ' An error occurred while changing state to ' + options.nextState + '!';
                throw exceptionModule.buildExceptionObject(error, constants.STATUS_CODES.INTERNAL_SERVER_ERROR);
                //msg = '';
            }
        }
        return msg;
    };
    var isDeletable = function(assetState, deletableStates) {
        var astState = assetState ? assetState.toLowerCase() : assetState;
        for (var index in deletableStates) {
            if (deletableStates[index].toLowerCase() == astState) {
                return true;
            }
        }
        return false;
    };
    /**
     * to set the checkItems of the currents asset's state
     * @param checkItems
     * @param asset current asset
     * @param am asset-manager
     * @return A list of check-items and checked:true/false
     */
    var setCheckItemState = function(checkItems, asset, am,lcName) {
        //Obtain the check item states for the asset
        try {
            var assetCheckItems = am.getLifecycleCheckItems(asset,lcName);
            var item;
            for (var index in assetCheckItems) {
                item = assetCheckItems[index];
                if (checkItems[index]) {
                    checkItems[index].checked = item.checked;
                }
            }
        } catch (e) {
            var msg = 'No check items are available for this asset state';
            if (log.isDebugEnabled()) {
                log.debug(e);
            }
        }
        return checkItems;
    };
    /**
     * The function changes the state of a single check item
     * @param  checkItemIndex      The index of the check item to be changed
     * @param  checkItemState The new state of the check item
     * @param  asset               The asset on which the operation needs to be performed
     * @param  state               The state information of the current asset
     * @param  am                  The asset Manager instance
     */
    var updateCheckItemState = function(checkItemIndex, checkItemState, asset, state, am,lcName) {
        //Check if the index provided is valid
        var msg;
        if ((checkItemIndex < 0) || (checkItemIndex > state.checkItems.length - 1)) {
            msg = 'Unable to change the state of the check item as the index does not point to' + ' a valid check item.The check item index must be between 0 and ' + state.checkItems.length + '.';
            throw exceptionModule.buildExceptionObject(msg, constants.STATUS_CODES.BAD_REQUEST);
        }
        //Check if the check item state is the same as the next state
        if (state.checkItems[checkItemIndex].checked == checkItemState) {
            msg = 'The state of the check item at index ' + checkItemIndex + ' was not changed as it is already ' + checkItemState;
            log.warn(msg);
            return;
            //throw msg;
        }
        //Invoke the state change
        try {
            log.info('Before invoking check item for '+lcName);
            am.invokeLifecycleCheckItem(asset, checkItemIndex, checkItemState,lcName);
        } catch (e) {
            if (log.isDebugEnabled()) {
                log.debug(e);
            }
            msg = 'Unable to change the state of check item ' + checkItemIndex + ' to ' + checkItemState;
            throw exceptionModule.buildExceptionObject(msg, constants.STATUS_CODES.INTERNAL_SERVER_ERROR);
        }
    };
    /**
     * The function updates the check items for a given asset
     * @param  options Incoming details
     * @param  asset   current asset
     * @param  am      asset-manager
     * @param  state   the current state of the asset
     * @return Boolean       Whether the request is successful or not
     */
    var updateCheckItemStates = function(options, asset, am, state) {
        var success = false;
        var msg = '';
        var lcName = resolveLifecycle(options, asset);
        //Check if the current state has any check items
        if ((state.checkItems) && (state.checkItems.length < 1)) {
            msg = 'Unable to change the state of the check item as the current state(' + state.id + ') does not have any check items';
            throw exceptionModule.buildExceptionObject(msg, constants.STATUS_CODES.BAD_REQUEST);
        }
        //Assume checking items will succeed
        success = true;
        var checkItemsList = options.checkItems;
        var checkItemIndex;
        var checkItemState;
        var checkItem;
        //Go through each check item in the check items
        for (var index in checkItemsList) {
            checkItem = checkItemsList[index];
            checkItemIndex = checkItem.index;
            checkItemState = checkItem.checked;
            if ((checkItemIndex != null) && (checkItemState == true || checkItemState == false)) {
                updateCheckItemState(checkItemIndex, checkItemState, asset, state, am,lcName);
            }
        }
        return success;
    };
    /**
     * The function will obtain the state detail of an asset
     * @param  options options.id=<asset-id>
     * @param  req     jaggery request
     * @param  res     jaggery response
     * @param  session   sessionID
     * @return A JSON object defining the structure of the lifecycle
     */
    api.getState = function(options, req, res, session) {
        log.info('### getState ###');
        var state;
        validateOptions(options);
        var assetApi = rxtModule.asset;
        var coreApi = rxtModule.core;
        var am = assetApi.createUserAssetManager(session, options.type); //get asset manager
        var server = storeModule.server; //get current server instance
        var user = server.current(session); //get current user
        var tenantId = user.tenantId; //get tenantID
        var asset = getAsset(options, am); //get asset
        var lcName = resolveLifecycle(options, asset);
        validateAsset(asset, options); //validate asset
        var lcApi = lifecycleModule.api; //load lifecycle module
        var lifecycle = lcApi.getLifecycle(lcName, tenantId);
        log.info('### lifecycle name: '+lcName+' ###');
        var rxtManager = coreApi.rxtManager(tenantId);
        var lcState = am.getLifecycleState(asset,lcName);
        log.info('### lifecycle state information: '+lcState+' ###');
        //Obtain the state data
        state = lifecycle.state(lcState);
        log.info('### After getting state ###');
        if (!state) {
            var msg = 'Unable to locate state information for ' + lcState;
            throw exceptionModule.buildExceptionObject(msg, constants.STATUS_CODES.NOT_FOUND);
        }
        log.info('### Before getting lifecycle ###');
        var defaultLifecycle = rxtManager.getLifecycleName(options.type);
        state.deletableStates = [];
        state.isDeletable = false;
        //We can only populate delete meta data if the default lifecycle
        //and the active lifecycle for the operation is the same
        if (defaultLifecycle === lcName) {
            //Obtain the deletable states
            state.deletableStates = rxtManager.getDeletableStates(options.type);
            //Determine if the current state is a deletable state
            state.isDeletable = isDeletable(lcState, state.deletableStates, lcName);
        }
        log.info('### Before check item states');
        //Update the state of the check items
        state.checkItems = setCheckItemState(state.checkItems, asset, am,lcName);
        log.info('### exited state ###');
        return state;
    };
    /**
     * The function will obtain the definition of the requested lifecycle
     * @param  options options.id=<asset-id>
     * @param  req     jaggery request
     * @param  res     jaggery response
     * @param  session   sessionID
     * @return A JSON object defining the structure of the
     */
    api.getLifecycle = function(options, req, res, session) {
        var lcApi = lifecycleModule.api; //load lifecycle module
        var server = storeModule.server; //load server instance
        var lifecycle = null;
        var user = server.current(session);
        if (!options.name) {
            log.warn('Unable to locate lifecycle definition as a name has not been provided.' + 'Please invoke the API with a lifecycle name');
            return lifecycle;
        }
        lifecycle = lcApi.getLifecycle(options.name, user.tenantId);
        if (!lifecycle) {
            log.warn('A lifecycle was not located for the lifecycle name: ' + options.name);
        }
        return lifecycle;
    };
    /**
     * The function will return a list of all available lifecycles for the currently logged in user's tenant.
     * @param  options options.id=<asset-id>
     * @param  req     jaggery request
     * @param  res     jaggery response
     * @param  session sessionID
     * @return An array of strings with the names of the lifecycles
     */
    api.getLifecycles = function(options, req, res, session) {
        var lcApi = lifecycleModule.api;
        var server = storeModule.server;
        //var lifecycle = null;
        var user = server.current(session);
        return lcApi.getLifecycleList(user.tenantId);
    };
    /**
     * The function changes the state of a set of check items sent as an array with each element been
     * { index: number , checked:true}
     * @param  options options.id=<asset-id>
     * @param  req     jaggery request
     * @param  res     jaggery response
     * @param  session   sessionID
     * @return A boolean value indicating the success of the operation
     */
    api.checkItems = function(options, req, res, session) {
        var isSuccess = false;
        validateOptions(options);
        var assetApi = rxtModule.asset;
        var am = assetApi.createUserAssetManager(session, options.type);
        var asset = getAsset(options, am);
        validateAsset(asset, options);
        var state = this.getState(options, req, res, session);
        isSuccess = updateCheckItemStates(options, asset, am, state);
        return isSuccess;
    };
    api.getHistory = function(options, req, res, session) {
        validateOptions(options);
        var assetApi = rxtModule.asset;
        var am = assetApi.createUserAssetManager(session, options.type);
        var history = am.getLifecycleHistory(options.id);
        return history;
    };
    api.listAllAttachedLifecycles = function(options, req, res, session) {
        validateOptions(options);
        var assetApi = rxtModule.asset;
        var am = assetApi.createUserAssetManager(session, options.type);
        return am.listAllAttachedLifecycles(options.id);
    };
}(api));
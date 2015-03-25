/*
 *  Copyright (c) 2005-2014, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 *  WSO2 Inc. licenses this file to you under the Apache License,
 *  Version 2.0 (the "License"); you may not use this file except
 *  in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing,
 *  software distributed under the License is distributed on an
 *  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 *  KIND, either express or implied.  See the License for the
 *  specific language governing permissions and limitations
 *  under the License.
 *
 */
var api = {};
(function(api) {
    var log = new Log();
    var ACTION_STATE = 'state';
    var ACTION_CHANGE_STATE = 'change-state';
    var ACTION_CHECKLIST = 'checklist';
    var ACTION_UPDATE_CHECKLIST = 'update-checklist';
    var ACTION_LC_HISTORY = 'lifecycle-history';
    var HTTP_ERROR_NOT_IMPLEMENTED = 501;
    var MSG_ERROR_NOT_IMPLEMENTED = 'The provided action is not supported by this endpoint';
    var lifecycleAPI = require('/modules/lifecycle/lifecycle-api.js').api;
    var utils = require('utils');
    var rxtModule = require('rxt');
    var exceptionModule = utils.exception;
    var constants = rxtModule.constants;
    var msg = function(code, message, data) {
        var obj = {};
        obj.code = code;
        obj.message = message;
        obj.data = data;
        return obj;
    };
    var successMsg = function(obj) {
        obj.success = true;
        return obj;
    };
    var errorMsg = function(obj) {
        obj.success = false;
        return obj;
    }
    var validateOptions = function(options) {
        if (!options.type) {
            var error = 'Unable to obtain state information without knowing the type of asset of id: ' + options.id;
            log.error(errorMsg);
            throw exceptionModule.buildExceptionObject(error, constants.STATUS_CODES.BAD_REQUEST);
        }
    }
    api.state = function(req, res, session, options) {
        if (req.getMethod() !== 'GET') {
            return error(msg(405, 'State must be retrieved using a GET'));
        }
        validateOptions(options);
        var result = lifecycleAPI.getState(options, req, res, session);
        return successMsg(msg(200, 'Asset state information returned', result));
    };
    api.changeState = function(req, res, session, options) {
        //Call the state change api
        var success = true;
        var newState = null;
        var result = {};
        if (success) {
            //Obtain the next states
            result.newState = '';
        }
        return successMsg(msg(200, 'The assets state was changed', result));
    };
    api.updateCheckList = function(req,res,session,options) {
    	//throw 'failed';
    	return successMsg(msg(200,'The checklist was updated successfully'));
    };
    api.lifecycleHistory = function() {};
    api.resolve = function(req, res, session, options) {
        log.info('### action: ' + options.action + ' ###');
        log.info('### id: ' + options.id + ' ###');
        var action = options.action;
        var result = errorMsg(msg(HTTP_ERROR_NOT_IMPLEMENTED, MSG_ERROR_NOT_IMPLEMENTED));
        switch (action) {
            case ACTION_STATE:
                result = api.state(req, res, session, options);
                break;
            case ACTION_CHANGE_STATE:
                result = api.changeState(req, res, session, options);
                break;
            case ACTION_UPDATE_CHECKLIST:
                result = api.updateCheckList(req, res, session, options);
                break;
            case ACTION_LC_HISTORY:
                result = api.lifecycleHistory(req, res, session, options);
                break;
            default:
                break;
        }
        log.info('### Resolve finished ###');
        log.info(result);
        log.info('### Finsihed ###');
        return result;
    };
}(api));
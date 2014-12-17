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

package org.wso2.es.integration.common.utils;

import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;

import org.wso2.carbon.automation.engine.extensions.ExecutionListenerExtension;

import java.io.IOException;

public class ESServerExtensionForWait extends ExecutionListenerExtension {

    private static final Log LOG = LogFactory.getLog(ESServerExtensionForWait.class);
    private static final long WAIT_TIME = 3000;
    private static final int MAX_ATTEMPT_COUNT = 10;

    /**
     * Initialize
     */
    public void initiate() {
        LOG.info("Initializing Testing Enterprise Store Jaggery-APPs");
    }

    /**
     * This method calls waitTillIndexingCompletes which holds test execution until indexing completes
     * or timeout while waiting to complete indexing
     */
    public void onExecutionStart() throws IOException, InterruptedException {
        LOG.info("Waiting till Jaggery-Apps get initialized");
        try {
            waitTillIndexingCompletes();
            LOG.info("Done Waiting till Jaggery-Apps get initialized");
        } catch (InterruptedException e) {
            LOG.error("Fail to wait till Jaggery-Apps get initialized ", e);
            throw e;
        }
    }

    /**
     * Once test execution is completed
     */
    public void onExecutionFinish() {
        LOG.info("Completed executing test cases for testing Jaggery-Apps");
    }

    /**
     * This method is used to hold test execution until indexing completes or timeout
     *
     * @throws InterruptedException
     */
    private static void waitTillIndexingCompletes() throws IOException, InterruptedException {
        AssetsRESTClient client = new AssetsRESTClient();
        int count = 0;
        Thread.sleep(WAIT_TIME);
        while (count < MAX_ATTEMPT_COUNT && !client.isIndexCompleted()) {
            count++;
            Thread.sleep(WAIT_TIME);
        }
    }
}
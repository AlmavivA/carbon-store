package org.wso2.carbon.social;

import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.mozilla.javascript.NativeObject;
import org.wso2.carbon.databridge.agent.thrift.DataPublisher;

import static org.wso2.carbon.social.Constants.*;
import static org.wso2.carbon.social.JSONUtil.getNullableProperty;
import static org.wso2.carbon.social.JSONUtil.getProperty;

public class ActivityPublisher {

    private static final Log LOG = LogFactory.getLog(ActivityPublisher.class);

    private DataPublisher publisher;
    private String streamId;


    public void publish(NativeObject activity) {
        DataPublisher publisher = getPublisher();
        try {
            String id = getStreamId(publisher);
            String json = JSONUtil.SimpleNativeObjectToJson(activity);
            String verb = getProperty(activity, VERB_JSON_PROP);
            String objectType = getProperty(activity, OBJECT_JSON_PROP, TYPE_JSON_PROP);
            String contextId = getNullableProperty(activity, CONTEXT_JSON_PROP, ID_JSON_PROP);
            if (contextId == null) {
                contextId = getProperty(activity, TARGET_JSON_PROP, ID_JSON_PROP);
            }

            publisher.publish(id, null, null, new Object[]{verb, objectType, contextId, json});
        } catch (Exception e) {
            LOG.error("failed to publish social event.", e);
        }
    }

    /**
     * lazy init for DataPublisher.
     *
     * @return DataPublisher for publishing activities.
     */
    private DataPublisher getPublisher() {

        //TODO: don't hardcore following.
        String host = "localhost";
        String url = "tcp://" + host + ":" + "7611";
        String username = "admin";
        String password = "admin";

        if (publisher == null) {
            try {
                publisher = new DataPublisher(url, username, password);
            } catch (Exception e) {
                LOG.error("Can't connect to data publisher", e);
            }
        }
        return publisher;
    }

    /**
     * lazy create stream.
     *
     * @return stream id for publishing activities.
     */
    private String getStreamId(DataPublisher publisher) {
        // stream id is cached in field streamId, if it's not there get it form publisher
        if (streamId == null && publisher != null) {
            try {
                streamId = publisher.findStreamId(STREAM_NAME, STREAM_VERSION);
                if (streamId == null) {
                    try {
                        streamId = publisher.defineStream(STREAM_DEF);
                        new ActivityBrowser().makeIndexes("context.id");
                    } catch (Exception e) {
                        LOG.error("Can't create " + STREAM_NAME + ":" +
                                STREAM_VERSION + " for storing social Activities", e);
                    }
                }
            } catch (Exception e) {
                LOG.error("Can't find " + STREAM_NAME + ":" +
                        STREAM_VERSION + " for storing social Activities", e);
            }
        }
        return streamId;
    }
}
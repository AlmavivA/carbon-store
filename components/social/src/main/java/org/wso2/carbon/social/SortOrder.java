package org.wso2.carbon.social;


import java.util.Collections;
import java.util.Comparator;
import java.util.List;

public enum SortOrder {
    NEWEST(null),
    OLDEST(new Comparator<Activity>() {
        @Override
        public int compare(Activity o2, Activity o1) {
            return o1.getTimestamp() - o2.getTimestamp();
        }
    }),
    POPULAR(new Comparator<Activity>() {
        @Override
        public int compare(Activity o1, Activity o2) {
            return o2.getLikeCount() - o1.getLikeCount();
        }
    });

    private Comparator<? super Activity> comparator;

    SortOrder(Comparator<Activity> comparator) {
        this.comparator = comparator;
    }

    public void sort(List<Activity> activities) {
        if (comparator != null) {
            Collections.sort(activities, comparator);
        }
    }

}

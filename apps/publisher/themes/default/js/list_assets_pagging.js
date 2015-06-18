var rows_added = 0;
var last_to = 0;
var items_per_row = 0;
var doPagination = true;
store.infiniteScroll ={};
store.infiniteScroll.recalculateRowsAdded = function(){
    return (last_to - last_to%items_per_row)/items_per_row;
};
store.infiniteScroll.addItemsToPage = function(){

    var screen_width = $(window).width();
    var screen_height = $(window).height();

    var thumb_width = 170;
    var thumb_height = 315;

    var gutter_width = 40;
    var header_height = 163;
    screen_width = screen_width - gutter_width; // reduce the padding from the screen size
    screen_height = screen_height - header_height;

    items_per_row = (screen_width-screen_width%thumb_width)/thumb_width;
    //var rows_per_page = (screen_height-screen_height%thumb_height)/thumb_height;
    var scroll_pos = $(document).scrollTop();
    var row_current =  (screen_height+scroll_pos-(screen_height+scroll_pos)%thumb_height)/thumb_height;
    row_current +=2 ; // We increase the row current by 2 since we need to provide one additional row to scroll down without loading it from backend


    var from = 0;
    var to = 0;
    if(row_current > rows_added && doPagination){
        from = rows_added * items_per_row;
        to = row_current*items_per_row;
        last_to = to; //We store this os we can recalculate rows_added when resolution change
        rows_added = row_current;
        store.infiniteScroll.getItems(from,to);
        console.info('getting items from ' + from + " to " + to + " screen_width " + screen_width + " items_per_row " + items_per_row);


    }

};

store.infiniteScroll.getItems = function(from,to){
    var count = to-from;
    var dynamicData = {};
    dynamicData["from"] = from;
    dynamicData["to"] = to;
    // Returns the jQuery ajax method
    var path = window.location.href; //current page path
    var param = '&&start=' + from + '&&count=' + count + setSortingParams(path) + setQueryParams(path);
    var assetType = store.publisher.type; //load type from store global object
    var url = '/publisher/apis/assets?type=' + assetType + param ; // build url for the endpoint call
    //var url = caramel.tenantedUrl(store.asset.paging.url+"&start="+from+"&count="+count);     //TODO enable tenanted url thing..
    console.info(url);

    $.ajax({
               url: url,
               type: 'GET',
               success: function(response) { //on success
                   var assets = convertTimeToUTC(response.data);
                   if (assets) {
                       renderView('list_assets_table_body', assets, '#list_assets_content', null);
                   } else { //if no assets retrieved for this page
                       doPagination = false;
                   }
               },
               error: function(response) { //on error
                   doPagination = false;
               }
           });
};
store.infiniteScroll.showAll = function(){
    $('.assets-container section').empty();
    store.infiniteScroll.addItemsToPage();
    $(window).scroll(function(){
        store.infiniteScroll.addItemsToPage();
    });
    $(window).resize(function () {
        //recalculate "rows_added"
        rows_added = store.infiniteScroll.recalculateRowsAdded();
        store.infiniteScroll.addItemsToPage();
    });
};
$(function() {
    /*
     * Pagination for listing page
     * */
    store.infiniteScroll.showAll();
});
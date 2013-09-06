/*
 Description: Renders the assets.jag view
 Filename:assets.js
 Created Date: 29/7/2013
 */
var render = function (theme, data, meta, require) {
    //var addAssetUrl = "/publisher/asset/" + data.meta.shortName +"";
    theme('single-col-fluid', {
        title: data.title,
        header: [
            {
                partial: 'header',
                context: data
            }
        ],
        ribbon: [
            {
                partial: 'ribbon',
                context: require('/helpers/breadcrumb.js').generateBreadcrumbJson(data)
            }
        ],
        leftnav: [
            {
                partial: 'left-nav',
                context: require('/helpers/left-nav.js').generateLeftNavJson(data)
            }
        ],
        listassets: [
            {
                partial: 'list-assets',
                context: data
            }
        ]
    });
};

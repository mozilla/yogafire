define('views/category',
    ['models', 'textoverflowclamp', 'settings', 'tracking', 'underscore', 'urls', 'utils', 'utils_local', 'z'],
    function(models, clamp, settings, tracking, _, urls, utils, utils_local, z) {
    'use strict';

    var cat_models = models('category');
    var app_models = models('app');

    return function(builder, args, params) {
        var category = args[0];
        params = params || {};

        var model = cat_models.lookup(category);
        var name = model && model.name;
        if (name) {
            builder.z('title', name);
        }

        builder.z('type', 'root ' + category);
        builder.z('show_cats', true);
        builder.z('cat', category);

        if ('src' in params) {
            delete params.src;
        }

        function build(_endpoint, pluck) {
            builder.start('category_yogafire/main.html', {
                app_cast: app_models.cast,
                category: category,
                endpoint: _endpoint,
                pluck: pluck,
                sort: params.sort,
            }).done(function() {
                clamp(document.querySelector('.collection + .desc'), 7);
            });
        }

        utils_local.checkOnline().done(function() {
            // Online.
            build(urls.api.unsigned.url('category', [category], params), 'objects');
        }).fail(function() {
            // Offline.
            build(settings['offline_' + category] , 'apps');
        });

        tracking.setPageVar(5, 'Category', category, 3);
    };
});

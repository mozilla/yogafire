define('views/category',
    ['settings', 'tracking', 'urls', 'utils', 'z'],
    function(settings, tracking, urls, utils, z) {
    'use strict';

    return function(builder, args, params) {
        var category = args[0];
        console.log('category found:', category);
        params = params || {};

        builder.z('type', 'root ' + category);
        builder.z('show_cats', true);
        builder.z('cat', category);

        if ('src' in params) {
            delete params.src;
        }

        builder.start('category_yogafire/main.html', {
            category: category,
        });

        tracking.setPageVar(5, 'Category', category, 3);
    };
});

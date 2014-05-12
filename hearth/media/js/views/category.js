define('views/category',
    ['models', 'settings', 'tracking', 'urls', 'utils', 'z'],
    function(models, settings, tracking, urls, utils, z) {
    'use strict';

    var cat_models = models('category');

    return function(builder, args, params) {
        var category = args[0];
        console.log('category found:', category);
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

        builder.start('category_yogafire/main.html', {
            category: category,
        });

        tracking.setPageVar(5, 'Category', category, 3);
    };
});

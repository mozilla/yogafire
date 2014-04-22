define('views/homepage',
    ['format', 'jquery', 'l10n', 'log', 'models', 'newsletter', 'textoverflowclamp', 'underscore', 'urls', 'utils', 'utils_local'],
    function(format, $, l10n, log, models, newsletter, clamp, _, urls, utils, u) {
    'use strict';

    var gettext = l10n.gettext;
    var console = log('homepage');

    var app_models = models('app');

    var catElm = '<li><a class="cat-{0} cat-icon-a" data-cat-slug="{0}" href="{1}">{2}</a></li>';
    var endpoint = '';

    return function(builder, args, params) {
        params = params || {};

        builder.z('title', '');  // We don't want a title on the homepage.

        builder.z('type', 'root');
        builder.z('search', params.name);
        builder.z('title', params.name);

        builder.z('cat', 'all');
        builder.z('show_cats', true);

        if ('src' in params) {
            delete params.src;
        }

        u.checkOnline().then(function() {
            endpoint = urls.api.unsigned.url('category', [''], params);
        }).fail(function() {
            endpoint = '/hearth/db/preloaded.json';
        });

        console.log('using endpoint: ', endpoint);

        builder.start('category_yogafire/main.html', {
            endpoint: endpoint,
            sort: params.sort,
            app_cast: app_models.cast
        }).done(function() {
            newsletter.init();
            clamp(document.querySelector('.collection + .desc'), 7);
        });
    };
});

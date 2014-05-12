define('views/homepage',
    ['format', 'l10n', 'log', 'models', 'notification', 'settings', 'urls', 'z'],
    function(format, l10n, log, models, notification, settings, urls, z) {
    'use strict';

    var gettext = l10n.gettext;
    var console = log('homepage');

    var catElm = '<li><a class="cat-{0} cat-icon-a" data-cat-slug="{0}" href="{1}">{2}</a></li>';

    z.body.on('click', '.support-list .online', function(e) {
        var $this = $(this);
        if (!z.onLine) {
            e.preventDefault();
            e.stopImmediatePropagation();
            notify({message: settings.offline_msg});
        }
    });

    return function(builder, args, params) {
        console.log("Homepage view hit.");
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

        builder.start('category_yogafire/main.html');
    };
});

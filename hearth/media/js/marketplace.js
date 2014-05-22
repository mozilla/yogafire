// Do this last- initialize the marketplace!
console.log('Mozilla(R) FP-MKT (R) 1.0');
console.log('   (C)Copyright Mozilla Corp 1998-2014');
console.log('');
console.log('64K High Memory Area is available.');

require.config({
    enforceDefine: true,
    paths: {
        'flipsnap': 'lib/flipsnap',
        'jquery': 'lib/jquery-2.0.2',
        'underscore': 'lib/underscore',
        'nunjucks': 'lib/nunjucks',
        'nunjucks.compat': 'lib/nunjucks.compat',
        'templates': '../../templates',
        'settings': ['settings_local', 'settings'],
        'format': 'lib/format',
        'textoverflowclamp': 'lib/textoverflowclamp'
    }
});

define(
    'marketplace',
    [
        'underscore',
        'jquery',
        'helpers',  // Must come before mostly everything else.
        'helpers_local',
        'buttons',
        'cache',
        'capabilities',
        'consumer_info',
        'mobilenetwork',  // Must come before cat-dropdown (for amd.js)
        'cat-dropdown',
        'content-ratings',
        'db',
        'forms',
        'header',
        'image-deferrer',
        'l10n',
        'lightbox',
        'log',
        'login',
        'models',
        'navigation',
        'outgoing_links',
        'overlay',
        'previews',
        'requests',
        'settings',
        'storage',
        'templates',
        'tracking',
        'urls',
        'user',
        'user_helpers',
        'utils',
        'views',
        'webactivities',
        'z'
    ],
function(_) {
    var console = require('log')('mkt');
    var capabilities = require('capabilities');

    // Use Native Persona, if it's available.
    if (capabilities.firefoxOS && 'mozId' in navigator && navigator.mozId !== null) {
        console.log('Native Persona is available');
        navigator.id = navigator.mozId;
    }

    if (!capabilities.performance) {
        // Polyfill `performance.now` for PhantomJS.
        // (And don't even bother with `Date.now` because IE.)
        window.performance = {
            now: function() {
                return +new Date();
            }
        };
    }
    var start_time = performance.now();

    console.log('Dependencies resolved, starting init');

    var $ = require('jquery');
    var consumer_info = require('consumer_info');
    var db = require('db');
    var format = require('format');
    var nunjucks = require('templates');
    var settings = require('settings');
    var z = require('z');

    var nunjucks_globals = require('nunjucks').require('globals');
    nunjucks_globals.REGIONS = settings.REGION_CHOICES_SLUG;
    nunjucks_globals.user_helpers = require('user_helpers');
    nunjucks_globals.iarc_names = require('content-ratings').names;
    nunjucks_globals.installed_apps = z.apps;

    // Jank hack because Persona doesn't allow scripts in the doc iframe.
    // Please just delete it when they don't do that anymore.
    // Note: If this list changes - please change it in webpay too or let #payments know.
    var doc_langs = ['bn-IN', 'en-US', 'fr', 'hi', 'ta'];
    var doc_lang = doc_langs.indexOf(navigator.l10n.language) >= 0 ? navigator.l10n.language : 'en-US';
    var doc_location = require('urls').media('/docs/{type}/' + doc_lang + '.html?20140419');
    settings.persona_tos = format.format(doc_location, {type: 'terms'});
    settings.persona_privacy = format.format(doc_location, {type: 'privacy'});

    z.body.addClass('html-' + require('l10n').getDirection());
    if (settings.body_classes) {
        z.body.addClass(settings.body_classes);
    }

    z.page.one('loaded', function() {
        console.log('Hiding splash screen (' + ((performance.now() - start_time) / 1000).toFixed(6) + 's)');
        // Remove the splash screen once it's hidden.
        var splash = $('#splash-overlay').addClass('hide');
        z.body.removeClass('overlayed').addClass('loaded');
        require('apps').getInstalled().done(require('buttons').mark_installeds);
        setTimeout(function() {
            splash.remove();
        }, 1500);
    });

    // This lets you refresh within the app by holding down command + R.
    if (capabilities.chromeless) {
        window.addEventListener('keydown', function(e) {
            if (e.keyCode == 82 && e.metaKey) {
                window.location.reload();
            }
        });
    }

    var buttons = require('buttons');
    if (capabilities.webApps) {
        document.addEventListener('visibilitychange', function() {
            // Refresh list of installed apps in case user uninstalled apps
            // and switched back.
            if (!document.hidden) {
                if (require('user').logged_in()) {
                    consumer_info.fetch(true);
                }
                require('apps').getInstalled().done(buttons.mark_uninstalleds);
            }
        }, false);
    }

    // Do some last minute template compilation.
    z.page.on('reload_chrome', function() {
        console.log('Reloading chrome');
        var context = {z: z};
        $('#site-header').html(nunjucks.env.render('header.html', context));
        $('.offline-screen').html(nunjucks.env.render('_includes/offline.html', {
            settings: settings
        }));
        z.body.toggleClass('logged-in', require('user').logged_in());
        z.page.trigger('reloaded_chrome');
    }).trigger('reload_chrome');

    z.page.on('before_login before_logout', function() {
        require('cache').purge();
    });

    z.body.on('click', '.site-header .back', function(e) {
        e.preventDefault();
        console.log('← button pressed');
        require('navigation').back();
    });

    z.body.on('click', '#incompatibility-banner .close', function(e) {
        e.preventDefault();
        console.log('Hiding incompatibility banner');
        z.body.removeClass('show-incompatibility-banner');
        require('storage').setItem('hide_incompatibility_banner', true);
    });

    // Image deferring.
    var ImageDeferrer = require('image-deferrer');
    var iconDeferrer = ImageDeferrer.Deferrer(100, null);
    var screenshotDeferrer = ImageDeferrer.Deferrer(null, 200);
    z.page.one('loaded', function() {
        iconDeferrer.setImages($('.icon.deferred'));
        screenshotDeferrer.setImages($('.screenshot img.deferred'));
    }).on('loaded loaded_more navigate fragment_loaded', function() {
        iconDeferrer.refresh();
        screenshotDeferrer.refresh();
    });
    nunjucks_globals.imgAlreadyDeferred = function(src) {
        /*
            If an image already has been loaded, we use this helper in case the
            view is triggered to be rebuilt. When pages are rebuilt, we don't
            mark images to be deferred if they have already been loaded.
            This fixes images flashing back to the placeholder image when
            switching between the New and Popular tabs on the home page.
        */
        var iconsLoaded = iconDeferrer.getSrcsAlreadyLoaded();
        var screenshotsLoaded = screenshotDeferrer.getSrcsAlreadyLoaded();
        var loaded = iconsLoaded.concat(screenshotsLoaded);
        return loaded.indexOf(src) !== -1;
    };

    window.addEventListener(
        'resize',
        _.debounce(function() {z.doc.trigger('saferesize');}, 200),
        false
    );

    z.body.on('click', '.try-again', function() {
        window.location.reload();
    });

    function startPage() {
        console.log('Triggering initial navigation');
        consumer_info.fetch();
        if (!z.spaceheater) {
            z.page.trigger('navigate', [window.location.pathname + window.location.search]);
        } else {
            z.page.trigger('loaded');
        }
    }

    // Initialize the database when localForage has loaded.
    localforage.ready().then(function() {
        console.log('Configuring localForage.');
        localforage.config({
            name: 'yogafire',
            storeName: 'yogafire',
            version: 1.0
        });
        localforage.setDriver(settings.localforage_driver);
    });

    // Use checkOnline to initialize z.onLine.
    require('utils_local').checkOnline().done(function() {
        console.log('Online, initializing page.');
        z.body.removeClass('offline');
        require('consumer_info').promise.done(function() {
            startPage();
        });
    }).fail(function() {
        console.log('Offline, initializing page.');
        z.body.addClass('offline');
        startPage();
    });

    // Set the tracking package version variable (dimension15).
    if (z.body.data('build-id')) {
        require('tracking').setVar(15, 'Package version', z.body.data('build-id'));
    }

    require('requests').on('deprecated', function() {
        // Divert the user to the deprecated view.
        z.page.trigger('divert', [require('urls').reverse('deprecated')]);
        throw new Error('Cancel navigation; deprecated client');
    });

    console.log('Initialization complete');
});

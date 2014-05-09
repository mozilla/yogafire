define('buttons',
    ['apps', 'cache', 'capabilities', 'defer', 'l10n', 'log', 'login',
     'models', 'notification', 'requests', 'settings',
     'tracking', 'tracking_helpers', 'urls', 'user', 'utils', 'views', 'z'],
    function() {

    var apps = require('apps');
    var cache = require('cache');
    var notify = require('notification').notification;
    var requests = require('requests');
    var tracking = require('tracking');
    var urls = require('urls');
    var user = require('user');
    var utils_local = require('utils_local');
    var z = require('z');

    var console = require('log')('buttons');

    var apps_model = require('models')('app');
    var gettext = require('l10n').gettext;

    function setButton($button, text, cls) {
        revertButton($button, text);
        $button.addClass(cls);
    }

    function revertButton($button, text) {
        $button.removeClass('purchasing installing error spinning');
        text = text || $button.data('old-text');
        $button.html(text);
    }

    function _handler(func) {
        return function(e) {
            e.preventDefault();
            e.stopPropagation();
            func.call(this, apps_model.lookup($(this).closest('[data-slug]').data('slug')));
        };
    }

    var launchHandler = _handler(function(product) {
        apps.launch(product.manifest_url);
        tracking.trackEvent(
            'Launch app',
            product.payment_required ? 'Paid' : 'Free',
            product.slug
        );
    });

    function install(product, $button) {
        var product_name = product.name;
        console.log('Install requested for', product_name);

        // Create a master deferred for the button action.
        var def = require('defer').Deferred();
        // Create a reference to the button.
        var $this = $button || $(this);

        // There's no payment required, just start install.
        console.log('Starting app installation for', product_name);
        // Start the app's installation.
        start_install();

        function start_install() {
            // Track the search term used to find this app, if applicable.
            require('tracking_helpers').track_search_term();

            // Track that an install was started.
            tracking.trackEvent(
                'Click to install app',
                product.receipt_required ? 'paid' : 'free',
                product_name + ':' + product.id,
                $('.button.product').index($this)
            );

            // Make the button a spinner.
            $this.data('old-text', $this.html())
                 .html('<span class="spin"></span>')
                 .addClass('spinning');

            return apps.install(product, {}).done(function(installer) {
                // Update the cache to show that the user installed the app.
                user.update_install(product.id);
                // Bust the cache for the My Apps page.
                cache.bust(urls.api.url('installed'));

                def.resolve(installer, product, $this);
            }).fail(function(error) {
                if (error) {
                    notify({message: error});
                }
                console.log('App install deferred was rejected for ', product.name);
                def.reject();
            });
        }

        // After everything has completed, carry out post-install logic.
        def.then(function(installer) {
            // Show the box on how to run the app.
            var $installed = $('#installed');
            var $how = $installed.find('.' + require('utils').browser());
            if ($how.length) {
                $installed.show();
                $how.show();
            }

            // Track that the install was successful.
            tracking.trackEvent(
                'Successful app install',
                product.receipt_required ? 'paid' : 'free',
                product_name + ':' + product.id,
                $('.button.product').index($button)
            );

            buttonInstalled(product.manifest_url, installer, $this);

            console.log('Successful install for', product_name);

        }, function() {
            // If the purchase or installation fails, revert the button.
            revertButton($this);
            console.log('Unsuccessful install for', product_name);

            // Track that the install failed.
            tracking.trackEvent(
                'App failed to install',
                product.receipt_required ? 'paid' : 'free',
                product_name + ':' + product.id,
                $('.button.product').index($button)
            );
        });

        return def.promise();
    }

    z.page.on('click', '.product.launch', launchHandler)
          .on('click', '.button.product:not(.launch):not(.incompatible)', _handler(install));

    function get_button(manifest_url) {
        return $('.button[data-manifest_url="' + manifest_url.replace(/"/, '\\"') + '"]');
    }

    function buttonInstalled(manifest_url, installer, $button) {
        // If the button wasn't passed, look it up.
        if (!$button || !$button.length) {
            $button = get_button(manifest_url);
            if (!$button.length) {
                return;
            }
        }
        z.apps[manifest_url] = installer;

        // L10n: "Open" as in "Open the app"
        setButton($button, gettext('Open'), 'launch install');
    }

    function revertUninstalled() {
        /* If an app was uninstalled, revert state of install buttons from
           "Launch" to "Install". */

        // Get installed apps to know which apps may have been uninstalled.
        var r = apps.getInstalled().done(function(results) {
            // Build an array of manifests that match the button's data-manifest.
            var installed = [];
            _.each(results, function(manifestURL) {
                installed.push(require('utils').baseurl(manifestURL));
            });

            $('.button.product').each(function(i, button) {
                var $button = $(button);
                // For each install button, check if its respective app is installed.
                if (installed.indexOf($button.data('manifest_url')) === -1) {
                    // If it is no longer installed, revert button.
                    if ($button.hasClass('launch')) {
                        revertButton($button, gettext('Install'));
                    }
                    $button.removeClass('launch');
                }
            });
        });
    }

    return {
        buttonInstalled: buttonInstalled,
        install: install,
        revertUninstalled: revertUninstalled,
    };
});

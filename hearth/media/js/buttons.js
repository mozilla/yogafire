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

        // TODO: Have the API possibly return this (bug 889501).
        product.receipt_required = (product.premium_type !== 'free' &&
                                    product.premium_type !== 'free-inapp' &&
                                    !require('settings').simulate_nav_pay);

        // If it's a paid app, it's unsupported for now.
        if (product.receipt_required) {
            console.log('Install cancelled; product is not free');
            notify({message: gettext('Payment cancelled.')});
        }

        // If there isn't a user object on the app, add one.
        if (!product.user) {
            console.warn('User data not available for', product_name);
            product.user = {
                purchased: false,
                installed: false,
                developed: false
            };
        }

        // Create a master deferred for the button action.
        var def = require('defer').Deferred();
        // Create a reference to the button.
        var $this = $button || $(this);
        var _timeout;

        // If the user has already purchased the app, we do need to generate
        // another receipt but we don't need to go through the purchase flow again.
        if (user.has_purchased(product.id)) {
            product.payment_required = false;
        }

        if (product.payment_required) {
            // The app requires a payment.
            notify({message: gettext('Payment cancelled.')});
            console.log('Purchase flow rejected for', product_name);
        } else {
            // There's no payment required, just start install.
            console.log('Starting app installation for', product_name);
            // Start the app's installation.
            start_install();
        }

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
            // Reset button if it's been 30 seconds without user action.
            _timeout = setTimeout(function() {
                if ($this.hasClass('spinning')) {
                    console.warn('Spinner timeout for', product_name);
                    revertButton($this);
                }
            }, 30000);

            // If the app has already been installed by the user and we don't
            // need a receipt, just start the app install.
            if (user.has_installed(product.id) && !product.receipt_required) {
                console.log('Receipt not required (skipping record step) for', product_name);
                return do_install();
            }

            // This is the data needed to record the app's install.
            var api_endpoint = urls.api.url('record_' + (product.receipt_required ? 'paid' : 'free'));
            var post_data = {app: product.id, chromeless: +require('capabilities').chromeless};

            // If we don't need a receipt to perform the installation...
            if (!product.receipt_required) {
                // Do the install immediately.
                do_install().done(function() {
                    // ...then record the installation.
                    requests.post(api_endpoint, post_data);
                    // We don't care if it fails or not because the user has
                    // already installed the app.
                });
                return;
            }

            // Let the API know we're installing.
            requests.post(api_endpoint, post_data).done(function(response) {
                // If the server returned an error, log it and reject the deferred.
                if (response.error) {
                    console.log('Server returned error: ' + response.error);
                    def.reject();
                    return;
                }

                do_install({data: {'receipts': [response.receipt]}});

            }).fail(function() {
                // L10n: The app's installation has failed, but the problem is temporary.
                notify({
                    message: gettext('Install failed. Please try again later.')
                });

                // Could not record/generate receipt!
                console.error('Could not generate receipt or record install for', product_name);
                def.reject();
            });
        }

        function do_install(data) {
            return apps.install(product, data || {}).done(function(installer) {
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

        // After everything has completed...
        def.then(function(installer) {
            // On install success, carry out post-install logic.

            // Clear the spinner timeout if one was set.
            if (_timeout) {
                clearTimeout(_timeout);
            }

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
        .on('click', '.button.product:not(.launch):not(.incompatible)', function(e) {
            // Are we offline?
            utils_local.checkOnline(function() {
                _handler(install);
            }, function() {
                notify({
                    message: gettext('Sorry, you are offline. Please try again later.')
                });
                e.preventDefault();
                e.stopPropagation();
            });
        });

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

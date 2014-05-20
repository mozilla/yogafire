define('buttons',
    ['apps', 'cache', 'capabilities', 'db', 'defer', 'l10n', 'log', 'login',
     'models', 'notification', 'requests', 'settings',
     'tracking', 'tracking_helpers', 'urls', 'user', 'utils', 'utils_local',
     'views', 'z'],
    function(apps, cache, capabilites, db, defer, l10n, log, login, models,
             notification, requests, settings, tracking, tracking_helpers, urls,
             user, utils, utils_local, views, z) {

    var console = log('buttons');
    var gettext = l10n.gettext;

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
            var that = this;
            db.get.app($(this).closest('[data-slug]').data('slug')).done(function(product) {
                func.call(that, product);
            });
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
        var def = defer.Deferred();
        // Create a reference to the button.
        var $this = $button || $(this);
        var _timeout;

        // There's no payment required, just start install.
        console.log('Starting app installation for', product_name);
        // Start the app's installation.
        start_install();

        function start_install() {
            // Track the search term used to find this app, if applicable.
            tracking_helpers.track_search_term();

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

            // HACK.
            // Temporary timeout for hosted apps until we catch the appropriate
            // download error event for hosted apps (in iframe).
            if (!product.is_packaged) {
                _timeout = setTimeout(function() {
                    if ($this.hasClass('spinning')) {
                        console.log('Spinner timeout for ', product_name);
                        revertButton($this);
                        notification.notification({message: settings.offline_msg});
                    }
                }, 20000);
            }

            return apps.install(product, {}).done(function(installer) {
                // Update the cache to show that the user installed the app.
                user.update_install(product.id);
                // Bust the cache for the My Apps page.
                cache.bust(urls.api.url('installed'));

                def.resolve(installer, product, $this);
            }).fail(function(error) {
                if (error) {
                    notification.notification({message: error});
                }
                console.log('App install deferred was rejected for ', product.name);
                def.reject();
            });
        }

        // After everything has completed, carry out post-install logic.
        def.then(function(installer) {
            // Clear the spinner timeout if one was set.
            if (_timeout) {
                clearTimeout(_timeout);
            }

            // Show the box on how to run the app.
            var $installed = $('#installed');
            var $how = $installed.find('.' + utils.browser());
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

            mark_installed(product.manifest_url);
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

    function mark_installed(manifest_url, $button) {
        setButton($button || get_button(manifest_url), gettext('Open'), 'launch install');
        apps.getInstalled();
    }

    function mark_installeds() {
        /* For each installed app, look for respective buttons and mark as
           ready to launch ("Open"). */
        setTimeout(function() {
            for (var i = 0; i < z.apps.length; i++) {
                $button = get_button(z.apps[i]);
                if ($button.length) {
                    // L10n: "Open" as in "Open the app".
                    mark_installed(null, $button);
                }
            }
        });
    }

    function mark_uninstalleds() {
        /* If an app was uninstalled, revert state of install buttons from
           "Launch" to "Install". */
        $('.button.product').each(function(i, button) {
            var $button = $(button);
            // For each install button, check if its respective app is installed.
            if (z.apps.indexOf($button.data('manifest_url')) === -1) {
                // If it is no longer installed, revert button.
                if ($button.hasClass('launch')) {
                    revertButton($button, gettext('Install'));
                }
                $button.removeClass('launch');
            }
        });
    }

    return {
        install: install,
        mark_installeds: mark_installeds,
        mark_uninstalleds: mark_uninstalleds,
    };
});

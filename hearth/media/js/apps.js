/*
    Provides the apps module, a wrapper around navigator.mozApps
*/
define('apps',
    ['apps_iframe_installer', 'buckets', 'capabilities', 'defer', 'l10n', 'log', 'nunjucks', 'settings', 'underscore', 'utils'],
    function(iframe_installer, buckets, capabilities, defer, l10n, log, nunjucks, settings, _, utils) {
    'use strict';

    var gettext = l10n.gettext;

    var console = log('apps');

    /*

    apps.install(manifest_url, options)
    apps.installPackage(manifest_url, options)

    It's just like navigator.apps.install with the following enhancements:
    - If navigator.apps.install doesn't exist, an error is displayed
    - If the install resulted in errors, they are displayed to the user

    This requires at least one apps-error-msg div to be present.

    See also: https://developer.mozilla.org/docs/DOM/Apps.install

    The recognized option attributes are as follows:

    data
        Optional dict to pass as navigator.apps.install(url, data, ...)
    success
        Optional callback for when app installation was successful
    error
        Optional callback for when app installation resulted in error
    navigator
        Something other than the global navigator, useful for testing

    */
    function install(product, opt) {
        var def = defer.Deferred();

        if (product.is_packaged) {
            // Bug 996150 for packaged Marketplace installing packaged apps.
            iframe_installer.iframe_install(product, opt).done(function(result, product) {
                def.resolve(result, product);
            }).fail(function(message, error) {
                def.reject(message, error);
            });
            return def.promise();
        }

        opt = opt || {};
        opt.data = opt.data || {};
        var manifest_url;
        if (product.manifest_url) {
            manifest_url = product.manifest_url;
        }
        if (manifest_url && product.is_packaged) {
            manifest_url = utils.urlparams(product.manifest_url, {feature_profile: buckets.profile});
        }

        var mozApps = (opt.navigator || window.navigator).mozApps;

        var installer = product.is_packaged ? 'installPackage' : 'install';
        console.log('Using `navigator.mozApps.' + installer + '` installer.');

        // Copy app categories to the installer.
        if (!('categories' in opt.data)) {
            opt.data.categories = product.categories;
        }

        // Try to install the app.
        if (manifest_url && mozApps && mozApps[installer]) {
            var installRequest = mozApps[installer](manifest_url, opt.data);
            installRequest.onsuccess = function() {
                console.log('App installation successful for', product.name);
                var status;
                var isInstalled = setInterval(function() {
                    status = installRequest.result.installState;
                    if (status == 'installed') {
                        console.log('App reported as installed for', product.name);
                        clearInterval(isInstalled);
                        def.resolve(installRequest.result, product);
                    }
                }, 250);
            };
            installRequest.onerror = function() {
                if (this.error.name === 'DENIED') {
                    def.reject();  // Don't return a message when the user cancels install.
                } else {
                    def.reject(gettext('App install error: {error}', {error: this.error.name || this.error}));
                }
            };
        } else {
            var reason;
            if (!manifest_url) {
                def.reject('Could not find a manifest URL in the product object.');
            } else if (product.is_packaged) {
                def.reject('Could not find platform support to install packaged app');
            } else {
                def.reject('Could not find platform support to install hosted app');
            }
        }

        def.then(function() {
            console.log('App installed successfully:', product.name);
        }, function(error) {
            console.error(error, product.name);
        });

        return def.promise();
    }

    /*
    apps.incompat(app_object)

    If the app is compatible, this function returns a falsey value.
    If the app is incompatible, a list of reasons why (plaintext strings) is returned.

    If you don't want to use the cached values, run the following command in your console:

        require('apps')._use_compat_cache(false);

    */

    var COMPAT_REASONS = '__compat_reasons';
    var use_compat_cache = true;
    function incompat(product) {
        // If the never_incompat setting is true, never disable the buttons.
        if (settings.never_incompat) {
            return;
        }

        // Cache incompatibility reasons.
        if (use_compat_cache && COMPAT_REASONS in product) {
            return product[COMPAT_REASONS];
        }

        var reasons = [];
        var device = capabilities.device_type();
        if (product.payment_required && !capabilities.navPay && !settings.simulate_nav_pay) {
            reasons.push(gettext('Your device does not support payments.'));
        } else if (product.payment_required && !product.price) {
            reasons.push(gettext('This app is unavailable for purchase in your region.'));
        }

        product[COMPAT_REASONS] = reasons.length ? reasons : undefined;
        return product[COMPAT_REASONS];
    }
    nunjucks.require('globals').app_incompat = incompat;

    return {
        incompat: incompat,
        install: install,
        _use_compat_cache: function(val) {use_compat_cache = val;}
    };
});

/*
    Interface with mozApps through m.f.c iframe since Yogafire is packaged with different origin.
*/
define('apps_iframe_installer',
    ['defer', 'l10n', 'log', 'settings', 'z'],
    function(defer, l10n, log, settings, z) {
    'use strict';
    var gettext = l10n.gettext;
    var console = log('apps_iframe_installer');

    window.addEventListener('message', function(e) {
        if (!e.data.name) {
            return;
        }
        switch (e.data.name) {
            case 'install-package':
                z.page.trigger('iframe-install-package', [e.data]);
                break;

            case 'getInstalled':
                z.page.trigger('iframe-getInstalled', [e.data]);
                break;
        }
    });

    var iframe_id = 'iframe-installer';
    if (!document.getElementById(iframe_id)) {
        var iframe = document.createElement('iframe');
        iframe.id = iframe_id;
        iframe.src = settings.iframe_installer_src;
        iframe.height = 0;
        iframe.width = 0;
        iframe.style.borderWidth = 0;
        document.body.appendChild(iframe);
    }

    var iframe_install = function(product, opt) {
        // m.f.c will receive this postMessage in hearth/iframe-install.html.
        console.log('Using iframe installer for ' + product.manifest_url);
        var def = defer.Deferred();

        iframe.contentWindow.postMessage({
            name: 'install-package',
            data: {
                product: product,
                opt: opt
            }
        }, '*');

        z.page.on('iframe-install-package', function(e, data) {
            console.log('Received message from iframe installer (install-package).');
            if (data && data.name == 'install-package' && data.appId == product.id) {
                if (data.error) {
                    // Fail.
                    console.log('iframe install failed: ' + data.error.error);
                    if (data.error.error == 'DENIED') {
                        def.reject();
                        return;
                    } else if (data.error.error == 'NETWORK_ERROR') {
                        def.reject(gettext('Sorry, you are offline. Please try again later.'));
                        return;
                    }
                    def.reject(gettext('App install error: {error}', data.error));
                } else {
                    // Success.
                    console.log('iframe install success');
                    def.resolve({}, data.product);
                }
            }
        });

        return def.promise();
    };

    var getInstalled = function() {
        console.log("Getting installed apps.");
        var def = defer.Deferred();

        z.page.one('iframe-getInstalled', function(e, data) {
            console.log('Received message from iframe installer (getInstalled).');
            if (data && data.name == 'getInstalled') {
                console.log("Got installed apps: " + data.result);
                def.resolve(data.result);
            }
        });

        iframe.contentWindow.postMessage({
            name: 'getInstalled',
        }, '*');

        return def.promise();
    };

    var launch_app = function(manifestURL) {
        iframe.contentWindow.postMessage({
            name: 'launch-app',
            manifestURL: manifestURL
        }, '*');
    };

    return {
        getInstalled: getInstalled,
        iframe_install: iframe_install,
        launch_app: launch_app,
    };
});

/*
    Install packaged app with iframe hack (postMessage to m.f.c) due to origin errors.
*/
define('apps_iframe_installer',
    ['defer', 'l10n', 'log', 'settings'],
    function(defer, l10n, log, settings) {
    'use strict';
    var gettext = l10n.gettext;
    var console = log('apps_iframe_installer');

    window.addEventListener('message', function(e) {
        console.log('Received message from iframe installer.');
        window.console.log(e);
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

        window.addEventListener('message', function(e) {
            console.log('Received message from iframe installer.');
            if (e.data && e.data.appId == product.id) {
                if (e.data.error) {
                    // Fail.
                    console.log('iframe install failed: ' + e.data.error.error);
                    def.reject(gettext('App install error: {error}', e.data.error));
                } else {
                    // Success.
                    console.log('iframe install success');
                    def.resolve({}, e.data.product);
                }
            }
        });

        return def.promise();
    };

    return {
        iframe_install: iframe_install,
    };
});

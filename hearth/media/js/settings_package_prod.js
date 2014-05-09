define('settings_local', ['localforage'], function(localforage) {
    return {
        api_url: 'https://marketplace.firefox.com',
        body_classes: 'package',
        media_url: 'https://marketplace.cdn.mozilla.net/media/',
        newsletter_enabled: false,
        payments_enabled: false,
        tracking_enabled: true,
        potatolytics_enabled: true,
        package_version: '{fireplace_package_version}',
        iframe_installer_src:  'https://marketplace.firefox.com/iframe-install.html',
        localforage_driver: localforage.INDEXEDDB
    };
});

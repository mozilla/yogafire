define('utils_local', ['log', 'z'], function(log, z) {
    var console = log('utils_local');

    var online = true;
    function checkOnline(online_cb, offline_cb) {
        // `navigator.onLine` is always accurate in Chrome,
        // but of course it's *never* accurate in Firefox
        // (since it is more to detect Offline Mode).
        // Would not recommend trying to use browser APIs to detect for now.
        // (bug 654579, bug 756364). Yeah, I know - sad times.
        var i = new Image();

        i.src = 'https://marketplace.cdn.mozilla.net/media/fireplace/img/grain.png?' + +new Date();
        i.onload = function() {
            if (!online) {
                // Fire event for going online.
                // Fire event to start loading images.
                z.win.trigger('online_detected image_defer');
                online = true;
            }
            if (online_cb) {
                online_cb();
            }
        };
        i.onerror = function() {
            console.log('Offline detected');
            if (online) {
                // Fire event for going offline.
                z.win.trigger('offline_detected');
                online = false;
            }
            if (offline_cb) {
                offline_cb();
            }
        };
    }

    return {
        checkOnline: checkOnline,
    };
});

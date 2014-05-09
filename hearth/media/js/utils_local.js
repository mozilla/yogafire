define('utils_local', ['defer', 'log', 'z'], function(defer, log, z) {
    var console = log('utils_local');

    z.onLine = true;
    function checkOnline(mock_offline) {
        // `navigator.onLine` is always accurate in Chrome,
        // but of course it's *never* accurate in Firefox
        // (since it is more to detect Offline Mode).
        // Would not recommend trying to use browser APIs to detect for now.
        // (bug 654579, bug 756364). Yeah, I know - sad times.
        var def = defer.Deferred();
        var i = new Image();

        if (mock_offline) {
            def.reject();
            return;
        }

        i.src = 'https://marketplace.cdn.mozilla.net/media/fireplace/img/grain.png?' + +new Date();
        i.onload = function() {
            if (!z.onLine) {
                console.log('Online detected.');
                // Fire event for going online.
                // Fire event to start loading images.
                z.win.trigger('online_detected image_defer');
                z.onLine = true;
            }
            def.resolve();
        };
        i.onerror = function() {
            if (z.onLine) {
                console.log('Offline detected.');
                // Fire event for going offline.
                z.win.trigger('offline_detected');
                z.onLine = false;
            }
            def.reject();
        };

        return def.promise();
    }

    setInterval(checkOnline, 10000);

    return {
        checkOnline: checkOnline,
    };
});

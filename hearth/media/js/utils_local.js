define('utils_local', ['defer', 'log', 'z'], function(defer, log, z) {
    var console = log('utils_local');

    function checkOnline() {
        // `navigator.onLine` sucks (bug 654579/756364).
        // Protip: to mock offline, do "require('z').onLine = false" (and gg money) in console.
        var def = defer.Deferred();
        var i = new Image();

        i.src = 'https://marketplace.cdn.mozilla.net/media/fireplace/img/grain.png?' + +new Date();
        i.onload = function() {
            if (!z.onLine) {
                // Fire event for going online.
                // Fire event to start loading images.
                console.log('Online detected.');
                z.win.trigger('online_detected image_defer');
                z.onLine = true;
            }
            def.resolve();
        };
        i.onerror = function() {
            if (z.onLine) {
                // Fire event for going offline.
                console.log('Offline detected.');
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

define('utils_local', ['defer', 'log', 'urls', 'z'], function(defer, log, urls, z) {
    var console = log('utils_local');
    var timeout = 5000; // 5 seconds.

    function checkOnline() {
        // `navigator.onLine` sucks (bug 654579/756364).
        // Protip: to mock offline, do "require('z').onLine = false" (and gg money) in console.
        var def = defer.Deferred();
        var xhr = new XMLHttpRequest();
        var url = urls.media('fireplace/img/grain.png?') + +new Date();

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (!z.onLine) {
                    // Fire event for going online.
                    // Fire event to start loading images.
                    console.log('Online detected.');
                    z.win.trigger('online_detected image_defer');
                    z.onLine = true;
                }
                def.resolve();
            }
        }

        xhr.open('GET', url, true);
        xhr.timeout = timeout;

        xhr.ontimeout = function() {
            if (z.onLine) {
                // Fire event for going offline.
                console.log('Offline detected.');
                z.win.trigger('offline_detected');
                z.onLine = false;
            }
            def.reject();
        }

        xhr.send();

        return def.promise();
    }

    clearInterval(z.onlineInterval);

    z.onlineInterval = setInterval(checkOnline, 10000);

    return {
        checkOnline: checkOnline,
    };
});

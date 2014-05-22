define('utils_local', ['defer', 'log', 'urls', 'z'], function(defer, log, urls, z) {
    var console = log('utils_local');
    var check_interval;
    var timeout = 10000;  // 10 seconds.

    function offline(def) {
        if (z.onLine) {
            // Fire event for going offline.
            console.log('Offline detected.');
            z.win.trigger('offline_detected');
            z.onLine = false;
        }
        def.reject();
    }

    function online(def) {
        if (!z.onLine) {
            // Fire event for going online.
            // Fire event to start loading images.
            console.log('Online detected.');
            z.win.trigger('online_detected image_defer');
            z.onLine = true;
        }
        def.resolve();
    }

    function checkOnline() {
        // `navigator.onLine` sucks (bug 654579/756364).
        // Protip: to mock offline, do "require('z').onLine = false" (and gg money) in console.
        var def = defer.Deferred();
        var xhr = new XMLHttpRequest();
        var url = urls.media('fireplace/img/grain.png?') + +new Date();

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                console.log('Got status ' + xhr.status + ' when requesting ' + url);
                if (xhr.status === 0) {
                    offline(def);
                } else {
                    online(def);
                }
            }
        };

        xhr.open('HEAD', url, true);
        xhr.timeout = timeout;

        xhr.ontimeout = function() {
            console.log('Timeout when requesting ' + url);
            offline(def);
        };

        xhr.send();
        return def.promise();
    }

    if (check_interval) {
        clearInterval(check_interval);
    }
    check_interval = setInterval(checkOnline, 10000);

    return {
        checkOnline: checkOnline,
    };
});

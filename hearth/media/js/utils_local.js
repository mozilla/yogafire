define('utils_local', ['defer', 'log', 'settings', 'urls', 'z'], function(defer, log, settings, urls, z) {
    var console = log('utils_local');
    var check_interval;
    var timeout = 10000;  // 10 seconds.

    function offline(socket, def) {
        if (z.onLine) {
            // Fire event for going offline.
            console.log('Offline detected.');
            z.win.trigger('offline_detected');
            z.onLine = false;
        }
        reset_socket(socket);
        def.reject();
    }

    function online(socket, def) {
        if (!z.onLine) {
            // Fire event for going online.
            // Fire event to start loading images.
            console.log('Online detected.');
            z.win.trigger('online_detected image_defer');
            z.onLine = true;
        }
        reset_socket(socket);
        def.resolve();
    }

    function reset_socket(socket) {
        socket.onopen = null;
        socket.onerror = null;
        socket.close();
    }

    function checkOnline() {
        // `navigator.onLine` sucks (bug 654579/756364).
        // Protip: to mock offline, do "require('z').onLine = false" (and gg money) in console.
        var def = defer.Deferred();
        // FIXME: try/catch and do something else on desktop since the permission won't be there.
        var host = (new URL(settings.cdn_url)).host;
        var port = 80;
        var socket = navigator.mozTCPSocket.open(host, port);
        console.log('Calling navigator.mozTCPSocket.open(' + host + ',' + port + ')');
        socket.onerror = function(e) {
            offline(socket, def);
        };
        socket.onopen = function(e) {
            online(socket, def);
        };

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

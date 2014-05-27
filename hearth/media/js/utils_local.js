define('utils_local', ['defer', 'log', 'settings', 'urls', 'z'], function(defer, log, settings, urls, z) {
    var console = log('utils_local');
    var check_interval;

    function offline(socket, def) {
        if (z.onLine) {
            // Fire event for going offline.
            console.log('Offline detected.');
            z.win.trigger('offline_detected');
            z.onLine = false;
        }
        if (socket) {
            reset_socket(socket);
        }
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
        if (socket) {
            reset_socket(socket);
        }
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
        if (navigator.mozTCPSocket === null) {
            return checkOnlineDesktop();
        }

        var def = defer.Deferred();

        try {
            var host = (new URL(settings.cdn_url)).host;
            var port = 80;
            var socket = navigator.mozTCPSocket.open(host, port);
        } catch (e) {
            return checkOnlineDesktop();
        }

        socket.onerror = function(e) {
            offline(socket, def);
        };
        socket.onopen = function(e) {
            online(socket, def);
        };

        return def.promise();
    }

    function checkOnlineDesktop() {
        var def = defer.Deferred();

        var i = new Image();
        i.src = urls.media('fireplace/img/grain.png?') + +new Date();
        i.onload = function() {
            online(null, def);
        };
        i.onerror = function() {
            offline(null, def);
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

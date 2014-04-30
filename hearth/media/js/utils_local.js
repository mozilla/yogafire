define('utils_local', ['log'], function(log) {
    var console = log('utils_local');

    function checkOnline(online, offline) {
        // `navigator.onLine` is always accurate in Chrome,
        // but of course it's *never* accurate in Firefox
        // (bug 654579, bug 756364). Yeah, I know - sad times.
        var i = new Image();

        i.src = 'https://marketplace.cdn.mozilla.net/media/fireplace/img/grain.png?' + +new Date();
        i.onload = function() {
            online();
        };
        i.onerror = function() {
            console.log('Offline detected');
            offline();
        };
    }

    return {
        checkOnline: checkOnline
    };
});

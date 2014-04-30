define('utils_local', ['log'], function(log) {
    var console = log('utils_local');

    function checkOnline() {
        // `navigator.onLine` is always accurate in Chrome,
        // but of course it's *never* accurate in Firefox
        // (bug 654579, bug 756364). Yeah, I know - sad times.
        var def = $.Deferred();
        var i = new Image();

        i.src = 'https://marketplace.cdn.mozilla.net/media/fireplace/img/grain.png?' + +new Date();
        i.onload = function() {
            def.resolve();
        };
        i.onerror = function() {
            console.log('Offline detected');
            def.reject();
        };
        setTimeout(function() {
            console.log('Offline detected');
            def.reject();
        }, 3000);

        return def.promise();
    }

    return {
        checkOnline: checkOnline
    }
});

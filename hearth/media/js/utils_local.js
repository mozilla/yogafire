define('utils_local', [], function() {
    function checkOnline() {
        // `navigator.onLine` is always accurate in Chrome,
        // but of course it's *never* accurate in Firefox
        // (bug 654579, bug 756364). Yeah, I know - sad times.
        var def = $.Deferred();
        var i = new Image();

        i.src = 'media/img/dummy.gif?' + +new Date();
        i.onload = function() {
            def.resolve();
        };
        i.onerror = function() {
            def.reject();
        };

        return def.promise();
    }

    return {
        checkOnline: checkOnline
    }
});

define('buckets', [], function() {

    return {
        // HACK: hardcoded tarako profile for performance, see bug 1003186,
        // bug 991301. This is the (incomplete, because of our feature detection
        // problems) profile that was reported by the code from 2014-04-29,
        // before it was removed.
        capabilities: [],
        profile: '7d7ba9fe6f6d.47.4'
    };

});

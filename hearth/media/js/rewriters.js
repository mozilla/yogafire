define('rewriters', ['log', 'settings'],
    function(log, settings) {

    var console = log('rewriters');

    if (!settings.cache_rewriting_enabled) {
        return [];
    }
    return [];
});

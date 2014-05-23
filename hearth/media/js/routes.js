(function() {

var dependencies;
/* dtrace */

// Please leave quotes around keys! They're needed for Space Heater.
var routes = [
    {'pattern': '^/(app.html|index.html)?$', 'view_name': 'homepage'},
    {'pattern': '^/app/([^/<>"\']+)/abuse$', 'view_name': 'app/abuse'},
    {'pattern': '^/app/([^/<>"\']+)/privacy$', 'view_name': 'app/privacy'},
    {'pattern': '^/app/([^/<>"\']+)/?$', 'view_name': 'app'},
    {'pattern': '^/search/?$', 'view_name': 'search'},
    {'pattern': '^/category/([^/<>"\']+)$', 'view_name': 'category'},
    {'pattern': '^/feedback$', 'view_name': 'feedback'},

    {'pattern': '^/privacy-policy$', 'view_name': 'privacy'},
    {'pattern': '^/terms-of-use$', 'view_name': 'terms'},
    {'pattern': '^/site/deprecated$', 'view_name': 'deprecated'},

    {'pattern': '^/debug$', 'view_name': 'debug'},
    {'pattern': '^/debug/features$', 'view_name': 'debug_features'},
];

// Only `require.js` has `window.require.defined`, so we can use this to
// sniff for whether we're using the minified bundle or not. (In production
// we use commonplace's `amd.js`.)
if (window.require.hasOwnProperty('defined')) {
    // The minified JS bundle doesn't need some dev-specific JS views.
    // Those go here.
    routes = routes.concat([
        {'pattern': '^/tests$', 'view_name': 'tests'}
    ]);
}

dependencies = routes.map(function(i) {
    return 'views/' + i.view_name;
});
/* /dtrace */
window.routes = routes;

define(
    'routes',
    // Dynamically import all the view modules from the routes
    dependencies,
    function() {
        for (var i = 0; i < routes.length; i++) {
            var route = routes[i];
            var view = require('views/' + route.view_name);
            route.view = view;
        }
        return routes;
    }
);

})();

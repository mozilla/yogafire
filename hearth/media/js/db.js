define('db', ['defer', 'format', 'log', 'requests', 'urls', 'utils', 'settings', 'underscore', 'z'],
    function(defer, format, log, requests, urls, utils, settings, _, z) {

    var console = log('db');

    // Localforage keys.
    function app_key(slug) { return 'app_' + slug; }
    function category_key(slug, page) { return 'category_' + slug + '_' + page; }
    var HOMEPAGE_KEY = 'homepage';
    var INSTALLED_KEY = 'installed';

    var offline_categories = {
        'tarako-featured': settings.offline_homepage,
        'tarako-games': settings['offline_tarako-games'],
        'tarako-tools': settings['offline_tarako-tools'],
        'tarako-lifestyle': settings['offline_tarako-lifestyle']
    };

    function getApp(slug) {
        /*
        Passed a slug, returns a promise that resolves to an app object with that
        slug.

        It fetches that data by kicking off two asynchronous tasks:
        1) An attempt to retrieve to the data from localforage.
        2) An HTTP request to fetch the data from the API.

        Resolves to whatever finishes first, localForage or API.
        */
        var def = defer.Deferred();

        localforage.getItem(app_key(slug)).then(function(data) {
            def.resolve(data);
            console.log('Returned', slug, 'from localforage.');
            background();
        });

        function background() {
            // Update in background.
            var url = urls.api.url('app', slug);
            // Request-cache app requests in memory by not passing in true since
            // app detail page calls the localForage tag multiple times at once.
            requests.get(url).done(function(data) {
                storeApp(data);
            });
        }

        return def.promise();
    }

    function getCategory(slug, page) {
        /*
        Passed a slug and 0-indexed page number, returns a promise that resolves to the
        passed page number for search results for a category with the passed slug.

        It fetches that data by kicking off two asynchronous tasks:
        1) An attempt to retrieve to the data from localforage.
        2) An HTTP request to fetch the data from the API.

        Resolves to whatever finishes first, localForage or API.
        */
        if (!slug) {
            return getHomepage();
        }

        var def = defer.Deferred();

        page = page || 0;
        localforage.getItem(category_key(slug, page)).then(function(data) {
            if (data) {
                def.resolve(data);
                console.log('Returned page', page, 'of', slug, 'category from localforage.');
                background();
            } else {
                requests.get(offline_categories[slug], true).done(function(data) {
                    console.log('Returned from package ' + slug);
                    def.resolve(data);
                    storeCategory(slug, data, page);
                    background();
                });
            }
        });

        function background() {
            // Update in background.
            var url = urls.api.url('category', slug, {
                limit: settings.num_per_page,
                offset: page * settings.num_per_page
            });
            requests.get(url, true).done(function(data) {
                storeCategory(slug, data, page);
            });
        }

        return def.promise();
    }

    function getHomepage() {
        /*
        Returns a promise that resolves to the tarako-featured collection.

        It fetches that data by kicking off two asynchronous tasks:
        1) An attempt to retrieve to the data from localforage.
        2) An HTTP request to fetch the data from the API.

        Resolves to whatever finishes first, localForage or API.
        */
        var def = defer.Deferred();

        localforage.getItem(HOMEPAGE_KEY).then(function(data) {
            if (data) {
                def.resolve(data);
                console.log('Returned homepage from localforage.');
                background();
            } else {
                requests.get(offline_categories['tarako-featured'], true).done(function(data) {
                    def.resolve(data);
                    console.log('Homepage first preload');
                    storeHomepage(data);
                    background();
                });
            }
        });

        function background() {
            // Update in background.
            var url = urls.api.url('collection', 'tarako-featured');
            requests.get(url, true).done(function(data) {
                storeHomepage(data);
            });
        }

        return def.promise();
    }

    function getSearch(endpoint, page) {
        /*
        Returns the API response, but stores all of the apps.
        */
        var def = defer.Deferred();

        if (page) {
            endpoint = utils.urlparams(endpoint, {
                limit: settings.num_per_page,
                offset: page * settings.num_per_page
            });
        }

        requests.get(endpoint).done(function(data) {
            data = normalize_apps(data);
            def.resolve(data);
            storeAppsFromSearch(data);
            console.log('Returned search from API.');
        });

        return def.promise();
    }

    function getInstalled() {
        var def = defer.Deferred();

        localforage.getItem(INSTALLED_KEY).then(function(installed) {
            z.apps = installed || [];
            def.resolve(installed || []);
        });

        return def.promise();
    }

    function storeApp(data) {
        // Passed an app, stores that app with localforage.
        console.log('Storing', data.slug, 'in localforage');
        localforage.setItem(app_key(data.slug), data);
    }

    function storeApps(data) {
        // Passed an array of apps, store those apps with localforage.
        _.each(data, function(app) {
            storeApp(app);
        });
    }

    function storeCategory(name, data, page) {
        /*
        Passed a catgory slug and API response of a search for that category:
        1) Stores the response of that category with localforage.
        2) Saves each app in that category.
        */
        console.log('Storing page', page, 'of', name, 'category in localforage');
        data = normalize_apps(data);
        localforage.setItem(category_key(name, page), data);
        storeApps(data.apps);
    }

    function storeHomepage(data) {
        /*
        Passed the API response of the homepage collection:
        1) Stores that response with localforage.
        2) Saves each app in that response.
        */
        console.log('Storing homepage in localforage');
        data = normalize_apps(data);
        localforage.setItem(HOMEPAGE_KEY, data);
        storeApps(data.apps);
    }

    function storeAppsFromSearch(data) {
        /*
        Store the apps from the search response, but don't store the search
        response itself for now.
        */
        console.log('Storing search in localforage');
        data = normalize_apps(data);
        storeApps(data.apps);
    }

    function storeInstalled(installed) {
        z.apps = installed;
        localforage.setItem(INSTALLED_KEY, installed || []);
    }

    function normalize_apps(data) {
        // Normalize to data.apps.
        if (data.objects) {
            data.apps = data.objects;
            delete data['objects'];
        }
        return data;
    }

    return {
        get: {
            app: getApp,
            category: getCategory,
            homepage: getHomepage,
            search: getSearch,
            installed: getInstalled,
        },
        store: {
            app: storeApp,
            category: storeCategory,
            homepage: storeHomepage,
            search: storeAppsFromSearch,
            installed: storeInstalled,
        },
        keys: {
            app: app_key,
            category: category_key,
            homepage: HOMEPAGE_KEY,
        }
    };

});

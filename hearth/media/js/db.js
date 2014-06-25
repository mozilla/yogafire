define('db', ['defer', 'format', 'log', 'requests', 'urls', 'utils', 'settings', 'underscore', 'z'],
    function(defer, format, log, requests, urls, utils, settings, _, z) {
    var console = log('db');

    var memcache = {};  // Keep stuff in memory as we pull it from lf.

    // Some constants and keys.
    var HOMEPAGE_SLUG = 'tarako-featured';
    var INSTALLED_KEY = 'installed';
    function app_key(slug) {
        return 'app_' + slug;
    }
    function category_key(slug, page) {
        if (!slug || slug == HOMEPAGE_SLUG) {
            return 'homepage';
        }
        return 'category_' + slug + '_' + page;
    }
    function search_key(endpoint, page) {
        // Currently only storing search in memory.
        endpoint = utils.urlparams(endpoint, {
            limit: settings.num_per_page,
            offset: page * settings.num_per_page
        });
        return 'search_' + endpoint;
    }
    var offline_categories = {
        'tarako-featured': settings['offline_tarako-featured'],  // Homepage.
        'tarako-games': settings['offline_tarako-games'],
        'tarako-tools': settings['offline_tarako-tools'],
        'tarako-lifestyle': settings['offline_tarako-lifestyle']
    };

    function getApp(slug) {
        /*
        Resolves to an app object.

        Returns from:
        - memory if the data has been fetched before in the current session.
        - localForage if the data has previously been stored.
        - API if data is not found in memory nor localForage (rare case).
        */
        var def = defer.Deferred();
        var api_url = urls.api.url('app', slug);

        var key = app_key(slug);
        if (key in memcache) {
            console.log('Returning app from memory', slug);
            return def.resolve(memcache[key]).promise();
        }

        localforage.getItem(key).then(function(data) {
            if (data) {
                // Data found in localForage.
                console.log('Returning app from localforage', slug);
                def.resolve(data);
                memcache[key] = data;
                background();
            } else {
                // Requesting app not in localForage, fetch from API.
                console.log('Returning app from API', slug);
                requests.get(api_url).done(function(data) {
                    def.resolve(data);
                    memcache[key] = data;
                    storeApp(data);
                });
            }
        });

        function background() {
            // Update in background.
            console.log('Updating app', slug);
            requests.get(api_url).done(function(data) {
                storeApp(data);
            });
        }

        return def.promise();
    }

    function getCategory(slug, page) {
        /*
        Resolves to apps of a category keyed under app. If no slug is passed,
        it will fetch homepage data. Kicks off an API request in the background
        to update data after everything is resolved.

        Returns from:
        - memory if the data has been fetched before in the current session.
        - localForage if the data has previously been stored.
        - API if we are requesting paginated data that has not yet been fetched.
        - package if data has never been fetched or stored.
        */
        var def = defer.Deferred();

        // Set up slug and API url depending on homepage or category.
        page = page || 0;
        var api_url = urls.api.url('category', slug, {
            limit: settings.num_per_page,
            offset: page * settings.num_per_page
        });
        if (!slug || slug == HOMEPAGE_SLUG) {
            slug = HOMEPAGE_SLUG;
            api_url = urls.api.url('collection', slug);
        }

        var key = category_key(slug, page);
        if (key in memcache) {
            console.log('Returning from memory', slug);
            return def.resolve(memcache[key]).promise();
        }

        localforage.getItem(key).then(function(data) {
            if (data) {
                console.log('Returning from localforage', slug, page);
                def.resolve(data);
                memcache_set(data);
                z.page.one('fragment_loaded', background);
            } else if (page) {
                console.log('Returning from API', slug, page);
                requests.get(api_url).done(function(data) {
                    data = normalize_apps(data);
                    def.resolve(data);
                    memcache_set(data);
                    z.page.one('fragment_loaded', function() {
                        storeCategory(slug, data, page);
                    });
                });
            } else {
                console.log('Returning from package', slug);
                requests.get(offline_categories[slug]).done(function(data) {
                    def.resolve(data);
                    memcache_set(data);
                    z.page.one('fragment_loaded', background);
                });
            }
        });

        function memcache_set(_data) {
            // Rewrites previous pages to allow hitting back and retain pos.
            var data = JSON.parse(JSON.stringify(_data));  // Clone object.
            if (page > 0) {
                // Concatenate with previous page.
                data.apps = memcache[category_key(slug, page - 1)].apps.concat(data.apps);
            }
            for (var i = 0; i <= page; i++) {
                // Update all previous pages.
                memcache[category_key(slug, i)] = data;
            }
        }

        function background() {
            // Update in background.
            console.log('Updating', slug);
            requests.get(api_url).done(function(data) {
                data = normalize_apps(data);
                memcache_set(data);
                storeCategory(slug, data, page);
            });
        }

        return def.promise();
    }

    function getSearch(endpoint, page) {
        /* Returns the API response (which is cached in memory by requests)
           Stores the API response into memory (and rewrites when getting pages > 0).
           Stores all of the apps in localForage. */
        var def = defer.Deferred();

        page = page || 0;
        endpoint = utils.urlparams(endpoint, {
            limit: settings.num_per_page,
            offset: page * settings.num_per_page
        });

        var key = search_key(endpoint, page);
        if (key in memcache) {
            console.log('Returning from memory', endpoint);
            return def.resolve(memcache[key]).promise();
        }

        requests.get(endpoint).done(function(data) {
            console.log('Returning search from API', endpoint);
            data = normalize_apps(data);
            def.resolve(data);
            memcache_set(data);
            storeAppsFromSearch(data);
        });

        function memcache_set(_data) {
            // Rewrites previous pages to allow hitting back and retain pos.
            var data = JSON.parse(JSON.stringify(_data));  // Clone object.
            if (page > 0) {
                // Concatenate with previous page.
                data.apps = memcache[search_key(endpoint, page - 1)].apps.concat(data.apps);
            }
            for (var i = 0; i <= page; i++) {
                // Update all previous pages.
                memcache[search_key(endpoint, i)] = data;
            }
        }

        return def.promise();
    }

    function getInstalled() {
        // Installed apps (manifestURLs).
        var def = defer.Deferred();

        localforage.getItem(INSTALLED_KEY).then(function(installed) {
            z.apps = installed || [];
            def.resolve(installed || []);
        });

        return def.promise();
    }

    function storeApp(data) {
        // Passed an app, stores that app with localforage.
        console.log('Storing app', data.slug);
        localforage.setItem(app_key(data.slug), data).then(function() {}, function(error) {
            if (error.name == 'QuotaExceededError' || error.name == 'NS_ERROR_DOM_QUOTA_REACHED') {
                console.log('Quota exceeded, clearing localforage');
                localforage.clear().then(function() {
                    storeApp(data);
                });
            }
        });
        memcache[app_key(data.slug)] = data;
    }

    function storeApps(data) {
        // Passed an array of apps, store those apps with localforage.
        console.groupCollapsed();
        _.each(data, function(app) {
            storeApp(app);
        });
        console.groupEnd();
    }

    function storeCategory(slug, data, page) {
        /*
        Passed a catgory slug and API response of a search for that category:
        1) Stores the response of that category with localforage.
        2) Saves each app in that category.
        */
        console.log('Storing', slug, page);
        data = normalize_apps(data);
        localforage.setItem(category_key(slug, page), data).then(function() {}, function(error) {
            if (error.name == 'QuotaExceededError' || error.name == 'NS_ERROR_DOM_QUOTA_REACHED') {
                console.log('Quota exceeded, clearing localforage');
                localforage.clear().then(function() {
                    storeCategory(slug, data, page);
                });
            }
        });
        storeApps(data.apps);
    }

    function storeAppsFromSearch(data) {
        /*
        Store the apps from the search response, but don't store the search
        response itself for now.
        */
        console.log('Storing search');
        data = normalize_apps(data);
        storeApps(data.apps);
    }

    function storeInstalled(installed) {
        // Installed apps (manifestURLs).
        z.apps = installed;
        localforage.setItem(INSTALLED_KEY, installed || []).then(function() {}, function(error) {
            if (error.name == 'QuotaExceededError' || error.name == 'NS_ERROR_DOM_QUOTA_REACHED') {
                console.log('Quota exceeded, clearing localforage');
                localforage.clear().then(function() {
                    storeInstalled(installed);
                });
            }
        });
    }

    function normalize_apps(data) {
        // Normalize data.objects to data.apps.
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
            search: getSearch,
            installed: getInstalled,
        },
        store: {
            app: storeApp,
            category: storeCategory,
            search: storeAppsFromSearch,
            installed: storeInstalled,
        },
        keys: {
            app: app_key,
            category: category_key,
        },
        cache: memcache
    };

});

define('db', ['defer', 'format', 'log', 'requests', 'urls', 'settings', 'underscore', 'z'],
    function(defer, format, log, requests, urls, settings, _, z) {

    var console = log('db');

    // Localforage keys.
    function app_key(slug) { return 'app_' + slug; }
    function category_key(slug, page) { return 'category_' + slug + '_' + page; }
    var HOMEPAGE_KEY = 'homepage';
    var PRELOADED_KEY = 'has_preloaded';
    var STORAGE_VERSION = 'storage_version';

    function preload() {
        console.log('Checking if data is already preloaded');
        localforage.getItem(PRELOADED_KEY, function(is_preloaded) {
            if (is_preloaded) {
                // Preload already finished from a previous run.
                console.log('Data already preloaded');
                z.body.trigger('lf_preloaded_finished');
            } else {
                console.log('Data not preloaded, preloading now');
                var promises = [];

                // Preload homepage.
                promises.push(new Promise(function(resolve, reject) {
                    requests.get(settings.offline_homepage, true).done(function(data) {
                        storeHomepage(data);
                        resolve();
                    });
                }));

                // Preload category pages from the package.
                // Category slugs must match category slug in the views.
                var categories = [
                    {slug: 'tarako-games', url: settings['offline_tarako-games']},
                    {slug: 'tarako-tools', url: settings['offline_tarako-tools']},
                    {slug: 'tarako-lifestyle', url: settings['offline_tarako-lifestyle']}
                ];
                _.each(categories, function(category) {
                    promises.push(new Promise(function(resolve, reject) {
                        requests.get(category.url, true).done(function(data) {
                            storeCategory(category.slug, data, 0);  // 0 because we preload the first page.
                            resolve();
                        });
                    }));
                });

                // Trigger event after everything is done.
                Promise.all(promises).then(function() {
                    console.log('Preload finished');
                    localforage.setItem(PRELOADED_KEY, true);
                    z.body.trigger('lf_preloaded_finished');
                });

                localforage.setItem(STORAGE_VERSION, settings.lf_storage_version);
            }
        });
    }

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
        var resolved = false;

        localforage.getItem(app_key(slug)).then(function(data) {
            if (data && !resolved) {
                resolved = true;
                def.resolve(data);
                console.log('Returned', slug, 'from localforage.');
            }
        });

        // Update in background.
        var url = urls.api.url('app', slug);
        // Request-cache app requests in memory by not passing in true since
        // app detail page calls the localForage tag multiple times at once.
        requests.get(url).done(function(data) {
            if (!resolved) {
                resolved = true;
                def.resolve(data);
                console.log('Returned', slug, 'from API.');
            }
            storeApp(data);
        });

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
        var resolved = false;

        page = page || 0;
        localforage.getItem(category_key(slug, page)).then(function(data) {
            if (data && !resolved) {
                resolved = true;
                def.resolve(data);
                console.log('Returned page', page, 'of', slug, 'category from localforage.');
            }
        });

        // Update in background.
        var url = urls.api.url('category', slug, {
            limit: settings.num_per_page,
            offset: page * settings.num_per_page
        });
        requests.get(url, true).done(function(data) {
            data = normalize_apps(data);
            if (!resolved) {
                resolved = true;
                def.resolve(data);
                console.log('Returned page', page, 'of', slug, 'category from API.');
            }
            storeCategory(slug, data, page);
        });

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
        var resolved = false;

        localforage.getItem(HOMEPAGE_KEY).then(function(data) {
            if (data && !resolved) {
                resolved = true;
                def.resolve(data);
                console.log('Returned homepage from localforage.');
            }
        });

        // Update in background.
        var url = urls.api.url('collection', 'tarako-featured');
        requests.get(url, true).done(function(data) {
            data = normalize_apps(data);
            if (!resolved) {
                resolved = true;
                def.resolve(data);
                console.log('Returned homepage from API.');
            }
            storeHomepage(data);
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

    function normalize_apps(data) {
        // Normalize to data.apps.
        if (data.objects) {
            data.apps = data.objects;
            delete data['objects'];
        }
        return data;
    }

    return {
        preload: preload,
        get: {
            app: getApp,
            category: getCategory,
            homepage: getHomepage
        },
        store: {
            app: storeApp,
            category: storeCategory,
            homepage: storeHomepage
        },
        keys: {
            app: app_key,
            category: category_key,
            homepage: HOMEPAGE_KEY,
            has_preloaded: PRELOADED_KEY
        }
    };

});

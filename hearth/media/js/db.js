define('db', ['format', 'localforage', 'log', 'requests', 'urls', 'settings', 'underscore', 'z'],
    function(format, localforage, log, requests, urls, settings, underscore, z) {

    var console = log('db');

    // Localforage keys.
    function app_key(slug) { return 'app_' + slug; }
    function category_key(slug) { return 'category_' + slug; }
    var HOMEPAGE_KEY = 'homepage';
    var PRELOADED_KEY = 'has_preloaded';

    function preload() {
        console.log('Checking if data is already preloaded');
        localforage.getItem(PRELOADED_KEY).then(function(is_preloaded) {
            console.log('resolved');
            if(is_preloaded) {
                console.log('Data already preloaded');
                z.body.trigger('lf_preloaded_finished');
            } else {
                console.log('Data not preloaded; preloading now');
                var promises = [];
                promises.push(new Promise(function(resolve, reject) {
                    requests.get(settings.offline_homepage, true).done(function (data) {
                        storeHomepage(data);
                        resolve();
                    });
                }));
                var categories = [settings['offline_tarako-games'], settings['offline_tarako-tools'], settings['offline_tarako-lifestyle']];
                _.each(categories, function(category) {
                    promises.push(new Promise(function(resolve, reject) {
                        requests.get(settings.offline_homepage, true).done(function (data) {
                            storeCategory(data);
                            resolve();
                        });
                    }));
                });
                Promise.all(promises).then(function() {
                    console.log('Preload finished');
                    localforage.setItem(PRELOADED_KEY, true);
                    z.body.trigger('lf_preloaded_finished');
                });
            }
        }, function(err) {
            console.log('rejected', err);
        }).fail(function(err) {
            console.log('rejected 2', err);
        });

    }


    function getApp(slug) {
        /*
        Passed a slug, returns a promise that resolves to an app object with that
        slug.
        
        It fetches that data by kicking off two asynchronous tasks:
        1) An attempt to retrieve to the data from localforage.
        2) An HTTP request to fetch the data from the API.

        Whichever task completes first will resolve the data. Regardless of which
        task does the resolution, the API call will complete and the data from the
        call will be stored with localforage.
        */
        return new Promise(function(resolve, reject) {
            var resolved = false;
            localforage.getItem(app_key(slug)).then(function(data) {
                if (data && !resolved) {
                    console.log('Returned', slug, 'from localforage.');
                    resolved = true;
                    resolve(data);
                }
            });
            var url = urls.api.url('app', slug);
            requests.get(url, true).done(function(data) {
                if (!resolved) {
                    console.log('Returned', data['slug'], 'from API.');
                    resolved = true;
                    resolve(data);
                }
                storeApp(data);
            });
        });
    }

    function getCategory(slug) {
        /*
        Passed a slug, returns a promise that resolves to search results for a
        category with that slug.
        
        It fetches that data by kicking off two asynchronous tasks:
        1) An attempt to retrieve to the data from localforage.
        2) An HTTP request to fetch the data from the API.

        Whichever task completes first will resolve the data. Regardless of which
        task does the resolution, the API call will complete and the data from the
        call will be stored with localforage.

        TODO: handle pagination.
        */
        return new Promise(function(resolve, reject) {
            var resolved = false;
            localforage.getItem(category_key(slug)).then(function(data) {
                if (data) {
                    console.log('Returned', slug, 'category from localforage.');
                    resolve(data);
                    resolved = true;
                }
            });
            var url = urls.api.url('category', slug);
            requests.get(url, true).done(function(data) {
                if (!resolved) {
                    console.log('Returned', slug, 'category from API.');
                    resolve(data);
                }
                storeCategory(slug, data);
            });
        });
    }

    function getHomepage() {
        /*
        Returns a promise that resolves to the tarako-featured collection.
        
        It fetches that data by kicking off two asynchronous tasks:
        1) An attempt to retrieve to the data from localforage.
        2) An HTTP request to fetch the data from the API.

        Whichever task completes first will resolve the data. Regardless of which
        task does the resolution, the API call will complete and the data from the
        call will be stored with localforage.

        TODO: Make featured.js read from this function.
        */

        return new Promise(function(resolve, reject) {
            var resolved = false;
            localforage.getItem(HOMEPAGE_KEY).then(function(data) {
                if (data) {
                    console.log('Returned homepage from localforage.');
                    resolve(data);
                    resolved = true;
                }
            });
            var url = urls.api.url('collection', 'tarako-featured');
            requests.get(url, true).done(function(data) {
                if (!resolved) {
                    console.log('Returned homepage from API.');
                    resolve(data);
                }
                storeHomepage(data);
            });
        });
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

    function storeCategory(name, data) {
        /*
        Passed a catgory slug and API response of a search for that category:
        1) Stores the response of that category with localforage.
        2) Saves each app in that category.
        */
        console.log('Storing', name, 'category in localforage');
        localforage.setItem(category_key(name), data);
        storeApps(data.objects);
    }

    function storeHomepage(data) {
        /*
        Passed the API response of the homepage collection:
        1) Stores that response with localforage.
        2) Saves each app in that response.
        */
        console.log('Storing homepage in localforage');
        localforage.setItem(HOMEPAGE_KEY, data);
        storeApps(data.apps);
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

define('db', ['defer', 'format', 'log', 'requests', 'urls', 'settings', 'underscore', 'z'],
    function(defer, format, log, requests, urls, settings, _, z) {

    var console = log('db');

    // Localforage keys.
    function app_key(slug) { return 'app_' + slug; }
    function category_key(slug, page) { return 'category_' + slug + '_' + page; }
    var HOMEPAGE_KEY = 'homepage';
    var PRELOADED_KEY = 'has_preloaded';
    var FEATURED_APPS = 'featured_cached';
    var FEATURED_UPDATED = 'featured_updated';

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
                var categories = [
                    {slug: 'games', url: settings['offline_tarako-games']},
                    {slug: 'tools', url: settings['offline_tarako-tools']},
                    {slug: 'lifestyle', url: settings['offline_tarako-lifestyle']}
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

        Whichever task completes first will resolve the data. Regardless of which
        task does the resolution, the API call will complete and the data from the
        call will be stored with localforage.
        */
        var def = defer.Deferred();
        var resolved = false;

        localforage.getItem(app_key(slug)).then(function(data) {
            if (data && !resolved) {
                // localForage request finished first.
                console.log('Returned', slug, 'from localforage.');
                resolved = true;
                def.resolve(data);
            }
        });

        var url = urls.api.url('app', slug);
        requests.get(url, true).done(function(data) {
            if (!resolved) {
                // API request finished first.
                console.log('Returned', data['slug'], 'from API.');
                resolved = true;
                def.resolve(data);
            }
            // Background update localForage.
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

        Whichever task completes first will resolve the data. Regardless of which
        task does the resolution, the API call will complete and the data from the
        call will be stored with localforage.
        */
        if (!slug) {
            return getHomepageToday();
        }

        var def = defer.Deferred();
        var resolved = false;

        localforage.getItem(category_key(slug, page)).then(function(data) {
            if (data && !resolved) {
                console.log('Returned page', page, 'of', slug, 'category from localforage.');
                def.resolve(data);
                resolved = true;
            }
        });

        page = page || 0;
        var url = urls.api.url('category', slug, {
            limit: settings.num_per_page,
            offset: page * settings.num_per_page
        });
        requests.get(url, true).done(function(data) {
            if (!resolved) {
                console.log('Returned page', page, 'of', slug, 'category from API.');
                def.resolve(data);
            }
            storeCategory(slug, data, page);
        });

        return def.promise();
    }

    function getHomepageAll() {
        /*
        Returns a promise that resolves to the tarako-featured collection.

        It fetches that data by kicking off two asynchronous tasks:
        1) An attempt to retrieve to the data from localforage.
        2) An HTTP request to fetch the data from the API.

        Whichever task completes first will resolve the data. Regardless of which
        task does the resolution, the API call will complete and the data from the
        call will be stored with localforage.
        */
        var def = defer.Deferred();
        var resolved = false;

        localforage.getItem(HOMEPAGE_KEY).then(function(data) {
            if (data && !resolved) {
                console.log('Returned homepage from localforage.');
                def.resolve(data);
                resolved = true;
            }
        });

        var url = urls.api.url('collection', 'tarako-featured');
        requests.get(url, true).done(function(data) {
            if (!resolved) {
                console.log('Returned homepage from API.');
                def.resolve(data);
                resolved = true;
            }
            storeHomepage(data);
        });

        return def.promise();
    }

    function regenerateHomepage() {
        /*
        Returns a promise that regenerates a selection of 6 apps for use in the
        homepage 'Featured Apps' selection. These apps are a subset of the apps in the
        tarako-featured collection, as returned by getHomepageAll, chosen at random and
        weighted by their overall popularity.
        */
        var def = defer.Deferred();

        getHomepageAll().then(function(response) {
            var apps = response.apps;

            // Create a weighted array of all the available items' indexes in `apps`.
            var weighted_index = [];
            for (var i = 0; i < apps.length; i++) {
                for (var n = 0; n < Math.ceil(apps[i].weight); n++) {
                    weighted_index.push(i);
                }
            }

            // Choose the appropriate number of random unique indexes from the weighted array.
            var chosen_items = [];
            while (chosen_items.length < 6 && chosen_items.length < apps.length) {
                var random = weighted_index[Math.floor(Math.random() * weighted_index.length)];
                if (chosen_items.indexOf(random) === -1) {
                    chosen_items.push(random);
                }
            }

            // Map the chosen indexes back to their original objects.
            response.apps = chosen_items.map(function(item) {
                return apps[item];
            });

            localforage.setItem(FEATURED_UPDATED, today);
            localforage.setItem(FEATURED_APPS, response);
            def.resolve(response);

        });

        return def.promise();

    };

    function getHomepageToday() {
        /*
        Returns apps for use in the homepage 'Featured Apps' category.

        If the selection of featured apps has already been made today, return those
        directly out of localforage. If not, generate a new selection, then return
        and store them.
        */
        var def = defer.Deferred();
        var today = new Date().toDateString();

        localforage.getItem(FEATURED_UPDATED).then(function(last) {
            if(last === today) {
                console.log('Using featured apps from cache: ' + today);
                localforage.getItem(FEATURED_APPS).then(function(featured) {
                    def.resolve(featured);
                });
            } else {
                console.log('Generating a new selection of featured apps');
                regenerateHomepage().then(function(featured) {
                    def.resolve(featured);
                });
            }
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
        localforage.setItem(category_key(name, page), data);
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
            homepage: getHomepageToday
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

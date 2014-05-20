define('db', ['defer', 'format', 'log', 'requests', 'urls', 'settings', 'underscore', 'z'],
    function(defer, format, log, requests, urls, settings, _, z) {

    var console = log('db');

    // Localforage keys.
    function app_key(slug) { return 'app_' + slug; }
    function category_key(slug, page) { return 'category_' + slug + '_' + page; }
    var HOMEPAGE_KEY = 'homepage';
    var PRELOADED_KEY = 'has_preloaded';
    var INSTALLED_KEY = 'installed';
    var KEYS_KEY = 'lf_keys';
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

    function quotaCheck() {
        /*
        Ensure that the estimated localforage size is beneath our 15 MB quota.
        If it isn't, recursively remove the items from the cache until it is.
        */
        localforage.getItem(KEYS_KEY).then(function(keys) {
            var overage = quotaEstimate(keys) - settings.localforage_quota;
            if (overage > 0) {
                var to_remove = keys.pop();
                console.log('localForage is', overage / 1024, 'MB over quota. Pruning oldest item', to_remove);
                Promise.all([
                    localforage.removeItem(to_remove),
                    localforage.setItem(KEYS_KEY, keys)
                ]).then(function() {
                    quotaCheck();
                });
            } else {
                console.log('localForage is', (-1 * overage) / 1024, 'MB under quota.');
            }
        });
    }

    function quotaTouch(key) {
        /*
        We are storing, using localforage, an array of the cache keys using substantial
        space (operationally defined as any apps, categories, or the homepage
        collection) in localforage. The first item in the array indicates the most
        recently-accessed key.

        This function does a number of things:
        1) Sets the array of keys, if it hasn't been set before.
        2) Adds (or moves) the passed cache key to the front of the list.
        3) Runs the quotaCheck function that determines whether or not it's necessary to
           prune items from the cache, doing so if it is necessary.
        */
        key = localforage._config.name + '/' + key;
        localforage.getItem(KEYS_KEY).then(function(keys) {
            if (keys) {
                var index = _.indexOf(keys, key);
                if (index > -1) {
                    keys.splice(index, 1);
                }
            } else {
                keys = []
            }
            keys.splice(0, 0, key);
            localforage.setItem(KEYS_KEY, keys).then(function() {
                quotaCheck();
            });
        });
    }

    var key_prefix_regexp = new RegExp(/([^_]+)/);

    function quotaEstimate(keys) {
        /*
        Estimate, based on the contents of the KEYS_KEY cache item, the size (in KB) of the
        localforage database.
        */
        function keyPrefix(key) {
            var lf_prefix = localforage._config.name + '/';
            key = key.substr(lf_prefix.length);
            return key.match(key_prefix_regexp);
        }
        return _.reduce(keys, function(memo, key){
            switch(keyPrefix(key)[0]) {
                case 'app':
                    return memo + 3;
                case 'category':
                    return memo + 100;
                case HOMEPAGE_KEY:
                    return memo + 20
                default:
                    return memo;
            }
        }, 0);
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

        var key = app_key(slug);
        quotaTouch(key);

        localforage.getItem(key).then(function(data) {
            if (data && !resolved) {
                resolved = true;
                def.resolve(data);
                console.log('Returned', slug, 'from localforage.');
            }
        });

        // Update in background.
        var url = urls.api.url('app', slug);
        requests.get(url, true).done(function(data) {
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

        var key = category_key(slug, page);
        quotaTouch(key);

        localforage.getItem(key).then(function(data) {
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

        quotaTouch(HOMEPAGE_KEY);

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
        },
        quota: {
            check: quotaCheck,
            estimate: quotaEstimate,
            touch: quotaTouch
        }
    };

});

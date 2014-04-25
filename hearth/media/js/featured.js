define('featured', ['storage', 'log'], function(storage, log) {

    var console = log('featured');

    // Constants representing cache keys.
    var FEATURED_APPS = 'featured_apps_cached';
    var LAST_UPDATED = 'featured_apps_last_updated';

    return {

        get: function(apps) {
            // Retrieve a subset of the featured apps from cache. If the cache has
            // expired, regenerate a random subset and return the featured apps.
            var today = new Date().toDateString();
            if (storage.getItem(LAST_UPDATED) === new Date().toDateString()) {
                console.log('Using featured apps from cache: ' + today);
                return JSON.parse(storage.getItem(FEATURED_APPS));
            }
            var regenerated = this.regenerate(apps);
            storage.setItem(FEATURED_APPS, JSON.stringify(regenerated || {}));
            storage.setItem(LAST_UPDATED, today);
            return regenerated;
        },

        regenerate: function(apps) {
            // From the pool of passed apps, return a randomized, weighted selection to be
            // displayed on the homepage.
            console.log('Generating a new selection of featured apps');

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
            return chosen_items.map(function(item) {
                return apps[item];
            });

        }

    };

});

var fs = require('fs');
var path = require('path');

var _ = require('lodash');
var request = require('request');
var Promise = require('es6-promise').Promise;

var utils = require('../lib/utils');


function generateFilename(url) {
  // Generates a pretty filename from a remote URL, turning
  // `97310.png?modified=1366438278` to `97310.png`.
  return path.basename(url).split('?')[0];
}

module.exports = function(settings, data) {
  return new Promise(function(resolveDB, rejectDB) {
    var images = {};

    data = data.apps.map(function(app) {
      app._id = app.id;
      app.icon = app.icons['64'];

      // Collect a list of image URLs (to later download to disk).
      // key = URL, value = directory name
      images[app.icon] = 'icons';
      if (app.previews.length > 0) {
        images[app.previews[0].thumbnail_url] = 'screenshots-thumbs';
      }

      // Flatten object of localised name to one key for easy searching.
      app.name_search = [];
      Object.keys(app.name).forEach(function(locale) {
        app.name_search.push(app.name[locale]);
      });
      app.name_search = app.name_search.join(' ').replace(/\(|\)/g, '');

      // Flatten object of localised name to one key for easy searching.
      app.description_search = [];
      Object.keys(app.description).forEach(function(locale) {
        app.description_search.push(app.description[locale]);
      });
      app.description_search = app.description_search.join(' ').replace(/\(|\)/g, '');

      // Transform from Zamboni categories to Tarako categories.
      // TODO: figure out a way to use transformMap from src/media/js/categories.js
      // so we don't need to dupe this constant.
      var categoryMap = {
        'games': 'games',
        'utilities': 'tools',
        'reference': 'tools',
        'productivity': 'tools',
        'education': 'tools',
        'business': 'tools',
        'travel': 'lifestyle',
        'sports': 'lifestyle',
        'social': 'lifestyle',
        'shopping': 'lifestyle',
        'photo-video': 'lifestyle',
        'news-weather': 'lifestyle',
        'music': 'lifestyle',
        'maps-navigation': 'lifestyle',
        'lifestyle': 'lifestyle',
        'health-fitness': 'lifestyle',
        'entertainment': 'lifestyle',
        'books': 'lifestyle'
      };
      var zcategories = app.categories;
      app.categories = [];
      _.forEach(zcategories, function (zcat) {
        var dcat = categoryMap[zcat];
        if (app.categories.indexOf(dcat) === -1) {
          app.categories.push(dcat);
        }
      });

      return _.pick(app, [
        '_id',
        'author',
        'categories',
        'content_ratings',
        'description',
        'description_search',
        'icon',
        'is_packaged',
        'homepage',
        'manifest_url',
        'name',
        'name_search',
        'previews',
        'privacy_policy',
        'ratings',
        'slug',
        'status',
        'support_email',
        'support_url',
      ]);
    });

    console.log('Transformed data');

    console.log('Fetching images to save to disk');

    var promises = [];

    _.uniq(Object.keys(images)).forEach(function(url) {
      promises.push(new Promise(function(resolve, reject) {
        console.log('Fetching', url);
        var fn = path.join(settings.downloads_dir, images[url], generateFilename(url));

        // Update filename.
        images[url] = path.relative(settings.frontend_dir, fn);

        var req = request(url).pipe(fs.createWriteStream(fn));
        var body = '';
        req.on('data', function (data) {
          body += data;
        });
        req.on('close', function() {
          // Cachebust these URLs with `?h=<contenthash>`.
          var hash = utils.computeHash(body);
          images[url] = utils.cachebust(images[url], hash);
          resolve();
        }).on('error', function() {
          reject();
        });
      }));
    });

    Promise.all(promises).then(function() {
      data = data.map(function (app) {
        app.icon = path.join('/', images[app.icon]);
        if (app.previews.length > 0) {
          app.previews[0].thumbnail_url = path.join('/', images[app.previews[0].thumbnail_url]);
        }
        return app;
      });

      fs.writeFile(settings.appcache_media,
        JSON.stringify(_.values(images).sort(), null, 2));

      console.log('Successfully saved all images to disk');
      resolveDB(data);
    }, function(err) {
      console.error('Failed to save images to disk:', err);
      rejectDB(err);
    });
  });
};


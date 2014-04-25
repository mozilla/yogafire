var fs = require('fs');
var path = require('path');

var _ = require('lodash');
var request = require('request');
var Promise = require('es6-promise').Promise;

var utils = require('../lib/utils');

var pretty_print = function(obj){ console.log(JSON.stringify(obj, null, 4)); };

module.exports = function(settings, data) {

  function imageLocations(url, prefix) {
    // Passed a URL, returns an object with two properties related to the
    // downloading of the URL for packaging:
    //
    // path:  the absolute path to which the passed URL should be downloaded.
    // url:   the absolute URL at which the downloaded file can be accessed.
    var relative_path = path.join(prefix, path.basename(url).split('?')[0]);
    return {
      'path': path.join(__dirname, '..', settings.downloads_dir, relative_path),
      'url': path.join(settings.downloads_url, relative_path)
    }
  }

  return new Promise(function(resolveDB, rejectDB) {
    var images = {};

    var apps = data.apps || data.objects;
    data = apps.map(function(app) {
      app._id = app.id;

      // Process the app's icon. We need to queue it for later downloading and
      // rewrite the JSON to use an absolute URL. We only need to worry about
      // the 64px icon.
      var icon = imageLocations(app.icons['64'], 'icons');
      images[app.icons['64']] = icon.path;
      app.icon = icon.url;

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

    _.uniq(Object.keys(images)).forEach(function(from) {
      var to = images[from];
      promises.push(new Promise(function(resolve, reject) {
        console.log('Storing', from);
        console.log('     at', to);

        var req = request(from).pipe(fs.createWriteStream(to));
        var body = '';
        req.on('data', function (data) {
          body += data;
        });
        req.on('close', function() {
          resolve();
        }).on('error', function() {
          reject();
        });

      }));
    });

    Promise.all(promises).then(function() {
      console.log('Successfully saved all images to disk');
      resolveDB({apps: data});
    }, function(err) {
      console.error('Failed to save images to disk:', err);
      rejectDB(err);
    });

  });
};


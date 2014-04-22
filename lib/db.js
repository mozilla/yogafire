var fs = require('fs');
var path = require('path');

var Promise = require('es6-promise').Promise;
var request = require('request');

var settings = require('../settings');
var utils = require('../lib/utils');


var db_dir = path.join(__dirname, '..', settings.db_dir);


module.exports.fetch = fetch = function fetch(dest, preloaded) {
  return new Promise(function (resolve, reject) {
    var now = Date.now();

    var fnOriginal = path.join(db_dir, 'original.json');
    var fnTransformed = dest;
    var fnArchivedOriginal = path.join(db_dir, 'archives', now + '-original.json');
    var fnPreloadedHash = path.join(db_dir, 'preloaded-hash.json');

    request(settings.db_url, function (err, res, body) {
      if (err) {
        console.error(err);
        reject(err);
        return;
      }

      fs.writeFile(fnOriginal, body);
      fs.writeFile(fnArchivedOriginal, body);

      var bodyJSON = JSON.parse(body);

      settings.db_transformer(bodyJSON).then(function success(data) {
        var bodyTransformed = JSON.stringify(data);
        var hash = utils.computeHash(bodyTransformed);
        var fnArchivedTransformed = path.join(db_dir, 'archives', hash + '.json');

        var promises = [
          new Promise(function (resolveFile) {
            fs.writeFile(fnTransformed, bodyTransformed, function () {
              console.log('Successfully wrote database to disk', fnTransformed);
              resolveFile();
            })
          }),
          new Promise(function (resolveFile) {
            fs.writeFile(fnArchivedTransformed, bodyTransformed, function () {
              console.log('Successfully wrote archived database to disk', fnArchivedTransformed);
              resolveFile();
            });
          })
        ];
        if (preloaded) {
          promises.push(new Promise(function (resolveFile) {
            fs.writeFile(fnPreloadedHash, hash, function () {
              console.log('Successfully wrote database hash to disk', fnPreloadedHash);
              resolveFile();
            });
          }));
        }
        Promise.all(promises).then(function () {
          console.log('Successfully wrote all database files to disk');
          resolve(data);
        });
      }, function error(err) {
        console.error('settings.db_transformer rejected:', err);
        reject(err);
      }).catch(function (err) {
        console.error('settings.db_transformer errored:', err);
        reject(err);
      });
    });
  });
};

module.exports.fetchPreloaded = function fetchPreloaded(dest) {
  return fetch(dest || path.join(db_dir, 'preloaded.json'), true);
};

module.exports.fetchLatest = function fetchLatest(dest) {
  return new Promise(function (resolve, reject) {
    var latest = fetch(dest || path.join(db_dir, 'latest.json'));
    latest.then(function (latestDocs) {
      // (1) Look up the hash of last DB file that was included in the appcache.
      // (2) Find the archived DB file that matches that hash.
      // (3) Read the file and remove the apps that were already present.
      // (4) Write that file to disk: `latest-since-<previousHash>.json`.
      // (5) The front end uses this static JSON file to fetch.
      fs.readFile(path.join(db_dir, 'preloaded-hash.json'), function (err, hash) {
        if (err) {
          console.error(err);
          reject(err);
          return;
        }
        var fnPreviousDB = path.join(db_dir, 'archives', hash + '.json');
        fs.readFile(fnPreviousDB, function (err, previousDB) {
          if (err) {
            console.error(err);
            reject(err);
            return;
          }

          var oldDocs = JSON.parse(previousDB);

          var idsToExclude = oldDocs.map(function (doc) {
            return doc._id.toString();
          });

          // Build an array of objects that weren't in the last DB that we appcached.
          var newDocs = latestDocs.filter(function (doc) {
            if (idsToExclude.indexOf((doc._id || '').toString()) === -1) {
              return doc;
            }
          });

          var fnLatestSince = path.join(db_dir,
            'latest-since-' + hash + '.json');
          fs.writeFile(fnLatestSince, JSON.stringify(newDocs), function () {
            resolve(newDocs);
          });
        });
      });
    }, function (err) {
      console.log('reject');
      reject(err);
    });
  });
};

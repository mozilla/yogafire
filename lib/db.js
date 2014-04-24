var fs = require('fs');
var path = require('path');

var Promise = require('es6-promise').Promise;
var request = require('request');

var settings = require('../settings');
var utils = require('../lib/utils');

var db_dir = path.join(__dirname, '..', settings.db_dir);


module.exports.fetch = function fetch(dest, src, slug) {
  return new Promise(function (resolve, reject) {
    var now = Date.now();

    var fnOriginal = path.join(db_dir, 'original_' + slug + '.json');
    var fnTransformed = dest;

    request(src, function (err, res, body) {
      if (err) {
        console.error(err);
        reject(err);
        return;
      }

      fs.writeFile(fnOriginal, body);

      settings.db_transformer(JSON.parse(body)).then(function success(data) {
        var write_db = new Promise(function (resolveFile) {
          fs.writeFile(fnTransformed, JSON.stringify(data), function () {
            fs.unlink(fnOriginal);
            console.log('Successfully wrote database to disk', fnTransformed);
            resolveFile();
          })
        });
        write_db.then(function () {
          console.log('Successfully database file to disk');
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

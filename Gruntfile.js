var db = require('./lib/db');
var utils = require('./lib/utils');
var settings = require('./settings');

module.exports = function(grunt) {
  grunt.initConfig({
    fetchdb: {
      options: {
        data_dest: settings.db_dir + '/latest.json'
      }
    }
  });

  // Always show stack traces when Grunt prints out an uncaught exception.
  grunt.option('stack', true);

  grunt.registerTask('fetchdb', 'Fetches JSON from API, downloads ' +
                                'icons/screenshots, and transforms data to ' +
                                'static JSON file to disk', function() {
    var done = this.async();
    var options = this.options();
    db.fetchLatest(options.data_dest).then(function() {
      grunt.log.writeln(
        'File ' + utils.color('cyan', options.data_dest) + ' created.');
      done();
    }, function(err) {
      grunt.log.writeln(utils.color('red',
        'File ' + options.file_dest + ' failed to be created: ' + err));
      done();
    }).catch(function(err) {
      grunt.log.writeln(utils.color('red', 'lib/db failed: ' + err));
      done();
    });

  });

  grunt.registerTask('default', ['fetchdb']);
};


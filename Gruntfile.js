var db = require('./lib/db');
var utils = require('./lib/utils');
var settings = require('./settings');

module.exports = function(grunt) {
  grunt.initConfig({
    fetchdb: {
      options: [
        {
          data_dest: settings.db_dir + '/home.json',
          data_src: 'https://marketplace.firefox.com/api/v1/fireplace/collection/tarako-featured/?region=restofworld',
          slug: 'home',
        },
        {
          data_dest: settings.db_dir + '/games.json',
          data_src: 'https://marketplace.firefox.com/api/v1/fireplace/search/featured/?cat=tarako-games&limit=10',
          slug: 'games',
        },
        {
          data_dest: settings.db_dir + '/tools.json',
          data_src: 'https://marketplace.firefox.com/api/v1/fireplace/search/featured/?cat=tarako-tools&limit=10',
          slug: 'tools',
        },
        {
          data_dest: settings.db_dir + '/lifestyle.json',
          data_src: 'https://marketplace.firefox.com/api/v1/fireplace/search/featured/?cat=tarako-lifestyle&limit=10',
          slug: 'lifestyle',
        },
      ]
    }
  });

  // Always show stack traces when Grunt prints out an uncaught exception.
  grunt.option('stack', true);

  grunt.registerTask('fetchdb', 'Fetches JSON from API, downloads ' +
                                'icons/screenshots, and transforms data to ' +
                                'static JSON file to disk', function() {
    var done = this.async();
    var options = this.options();

    var counter = 0;
    function check_done() {
      if (counter++ == Object.keys(options).length - 1) {
        done();
      }
    }

    for (var i = 0; i < Object.keys(options).length; i++) {
      var category = options[i];
      db.fetch(category.data_dest, category.data_src, category.slug).then(function() {
        grunt.log.writeln(
          'File ' + utils.color('cyan', category.data_dest) + ' created.');
        check_done();
      }, function(err) {
        grunt.log.writeln(utils.color('red',
          'File ' + category.data_dest + ' failed to be created: ' + err));
        check_done();
      }).catch(function(err) {
        grunt.log.writeln(utils.color('red', 'lib/db failed: ' + err));
        check_done();
      });
    }
  });

  grunt.registerTask('default', ['fetchdb']);
};


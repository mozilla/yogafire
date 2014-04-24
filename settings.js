var dbTransformer = require('./lib/db-transformer');

var settings = {
  debug: true,
  frontend_dir: 'hearth',
  use_data_uris: true
};

settings.db_dir = settings.frontend_dir + '/db';

settings.downloads_url = '/downloads';
settings.downloads_dir = settings.frontend_dir + settings.downloads_url;

settings.db_transformer = function(data) {
  return dbTransformer(settings, data);
};

module.exports = settings;


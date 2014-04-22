var dbTransformer = require('./lib/db-transformer');

var settings = {
  debug: true,
  db_url: 'https://marketplace-dev.allizom.org/api/v1/fireplace/collection/curated/?region=restofworld',
  frontend_dir: 'hearth',
  use_data_uris: true
};

settings.db_dir = settings.frontend_dir + '/db';
settings.downloads_dir = settings.frontend_dir + '/downloads';

settings.db_transformer = function(data) {
  return dbTransformer(settings, data);
};

module.exports = settings;


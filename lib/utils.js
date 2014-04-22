var crypto = require('crypto');


var colors = {
  cyan: '\x1B[36m',
  red: '\x1B[31m'
};

module.exports.color = function color(whichColor, text) {
  return colors[whichColor] + text + '\x1B[39m';
};

module.exports.cachebust = function cachebust(fn, hash) {
  var extPos = fn.lastIndexOf('.');
  return fn.substr(0, extPos) + '.hash_' + hash + fn.substr(extPos);
};

module.exports.computeHash = function computeHash(contents) {
  var hasher = crypto.createHash('sha256');
  hasher.update(contents, 'binary');
  return hasher.digest('hex').substr(0, 7);
};

module.exports.baseurl = function baseurl(url) {
  return url.split('?')[0];
};

module.exports.urlparams = function urlparams(url, qs) {
  if (url.indexOf('?') === -1) {
    return url + '?' + qs;
  }
  return url + '&' + qs;
};

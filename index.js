try {
  module.exports = require('./lib/couchdb');
}
catch(err) {
  module.exports = require('./lib/template.js');
}

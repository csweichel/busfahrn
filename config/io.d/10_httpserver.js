
var Auth        = require(__lib + 'authenticator.js'),
    io_http     = require(__lib + 'io_httpserver.js'),
    conf        = require(__config + 'httpserver.json');

module.exports = function(bus, history) {
    var auth = new Auth(conf.auth);
    
    return new io_http(bus, auth, conf.server.max_timestamp_age).start(conf.server.port);
};

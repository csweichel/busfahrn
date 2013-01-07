
var io_redis = require(__lib + 'io_redis.js');

module.exports = function(bus, modules) {
    return new io_redis(bus)(function(io) {
        io.listen("_all");
    });
};



var io_redis = require(__lib + 'io_redis.js');

module.exports = function(bus, modules) {
    // configuration for the redis module:
    //   - captured using a strategy: none, default, status and timeseries messages
    //   - has to support storage and retrieval
    
    return new io_redis(bus)(function(io) {
        io.listen("_all", [
            [ /inspection.*/ , io_redis.Strategy.none      ],
            [ /status.*/     , io_redis.Strategy.status    ],
            [ /time.*/       , io_redis.Strategy.timeseries],
        ]);
    });
    
};


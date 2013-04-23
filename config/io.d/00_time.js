
var io_time = require(__lib + 'io_time.js');

/**
 * Adds a time aspect to the bus by producing a time signal
 * every minute.
 * 
 * @produces time.minute.1
 * @uses io.time
 */
module.exports = function(bus, modules) {
    return new io_time(bus)(function(io) {
        io.connect(60 * 1000, "time.minute.1");
        io.connect(60 * 1000, "time.minute.5");
    });
};

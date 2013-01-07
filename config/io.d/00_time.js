
var io_time = require(__lib + 'io_time.js');

module.exports = function(bus, modules) {
    return new io_time(bus)(function(io) {
        io.connect(60 * 1000, "time.minute.1");
    });
};

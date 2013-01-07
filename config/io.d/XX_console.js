
var io_console = require(__lib + 'io_console.js');

module.exports = function(bus, modules) {
    return new io_console(bus)(function(io) {
        io.listen("_all");
    });
};

var request = require('request');

function error(msg) { throw msg; }

function IO_HTTPClient(bus, url, method) {
    this._bus    = bus;
    this._url    = url    || error("No URL given");
    this._method = method || "POST";
    
    var io = this;
    return function(f) {
        f(io);
        return io;
    };
}

IO_HTTPClient.prototype.listen = function(msgtype, callback) {
    callback = callback || function(err, res, body) { };
    
    var io = this;
    this._bus.listen(msgtype, function(msgtype, time, msg) {
        request(io._url, { body: JSON.stringify({ msgtype: msgtype, time: time, msg: msg }), method: io._method }, callback);
    });
};

module.exports = IO_HTTPClient;

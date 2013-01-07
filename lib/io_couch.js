
var nano = require('nano');


function Couch_IO(bus, url, dbname) {
    this._bus = bus;
    var connection = nano(url);
    this._db = connection.use(dbname);
    
    var io = this;
    return function(f) {
        f(io);
        return io;
    };
}

Couch_IO.prototype.listen = function(msgtype) {
    var db = this._db;
    this._bus.listen(msgtype, function(msgtype, time, msg) {
        db.insert({
            msgtype: msgtype,
            time:    time,
            message: msg
        });
    });
}

module.exports = Couch_IO;

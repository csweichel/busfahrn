
function IO_Time(bus) {
    this._bus = bus;
    
    var io = this;
    return function(f) {
        f(io);
        return io;
    };
}

IO_Time.prototype.connect = function(timeout, msgtype, msg) {
    msg = msg || {};
    
    var io = this;
    setInterval(function() {
        io._bus.post(msgtype, msg);
    }, timeout);
    
    return io;
};

module.exports = IO_Time;

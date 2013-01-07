
function IO_Console(bus) {
    this._bus = bus;
    
    var io = this;
    return function(f) {
        f(io);
        return io;
    };
}

IO_Console.prototype.listen = function(msgtype) {
    this._bus.listen(msgtype, function(msgtype, time, msg) {
       console.log(time + ", " + msgtype + " :: " + JSON.stringify(msg)); 
    });
};

module.exports = IO_Console;


var serialport = require('serialport');

function IO_Serial(bus, port, baudrate) {
    baudrate = baudrate || 9600;
    
    this._bus = bus;
    this._port = new serialport.SerialPort(port, {
        baudrate: baudrate,
        parser:   serialport.parsers.readline("\n")
    });
    
    var io = this;
    return function(f) {
        io._port.on("open", function() { f(io); });
        return io;
    };
}

IO_Serial.prototype.connect = function(translator) {
    translator = translator || function(data) {
        var message = data.split(" ");
        return { type: message[0], msg: message.slice(1).join(" ") };
    };
    
    var bus = this._bus;
    this._port.on('data', function(data) {
        var msg = translator(data);
        bus.post(msg.type, msg.msg);
    });
    return this;
};

IO_Serial.prototype.listen = function(msgtype, translator) {
    translator = translator || function(msgtype, time, msg) {
        return JSON.stringify(msg);
    };
    
    var io = this;
    var disconnect = this._bus.listen(msgtype, function(msgtype, time, msg) {
        io._port.write(translator(msgtype, time, msg));
    });
    io._port.on("close", function() { disconnect(); });
    
    return this;
};

module.exports = IO_Serial;

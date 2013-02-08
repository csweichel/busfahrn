var dgram  = require("dgram"),
    Buffer = require('buffer').Buffer;

function IO_UDP(bus, enable_autodiscovery, host_map) {
    this._bus = bus                            || function() {throw "IO_UDP needs a bus to work with";}();
    this._autodiscovery = enable_autodiscovery || false;
    this._host_map = host_map                  || {};
    this._connections = {};
    
    //if(enable_autodiscovery) this._loadHostMapViaInspection();
    
    var io = this;
    return function(f) {
        f(io);
        return io;
    };
}

IO_UDP.prototype.start = function(port) {
    var io = this;
    
    var server = dgram.createSocket("udp4");
    server.on("message", function (msg, rinfo) {
        try {
            io._handleMessage(JSON.parse(msg), rinfo.address, rinfo.port);
        } catch(e) {}
    });
    server.bind(port);
};

IO_UDP.prototype.listen = function(type, designation, translator) {
    translator = translator || function(type, time, msg) { return JSON.stringify({ type: type, time: time, msg: msg }) };
    
    var io = this;
    io._bus.listen(type, function(type, time, msg) {
        var host = io._host_map[designation];
        if(host === undefined) return;
        
        var buf = new Buffer(translator(type, time, msg));
        var socket = dgram.createSocket("udp4");
        socket.send(buf, 0, buf.length, host[1], host[0], function(err, bytes) {
            socket.close();
        });
    });
};

IO_UDP.prototype.connect = function(type, translator) {
    translator = translator || function(msg) { return msg; };
    this._connections[type] = translator;
};

IO_UDP.prototype._loadHostMapViaInspection = function() {
    var io = this;
    this._bus.peek("inspection.latest.status.ioudp.hostmap", function(type, time, msg) {
        if(msg.length > 0) {
            var result = msg[0].msg;
            for (var attrname in io._host_map) { result[attrname] = io._host_map[attrname]; }
            io._host_map = result;
        }
    });
    this._bus.peek("_busfarhn.started", function(type, time, msg) {
        io._bus.post("inspection.latest", { "type" : "status.ioudp.hostmap" });
    });
};

IO_UDP.prototype._handleMessage = function(body, address, port) {
    var io = this;
    if(body.type === undefined || body.msg === undefined) return;
    var type = body.type;
    var msg  = body.msg;
    
    if(type == "io.udp.register") {
        if(this._autodiscovery && msg.designation !== undefined) 
            this._registerHost(msg.designation, address, msg.port || port);
    } else {
        var unmarshal = this._connections[type];
        if(unmarshal !== undefined) {
            io._bus.post(type, unmarshal(msg));
        }
    }
};

IO_UDP.prototype._registerHost = function(designation, address, port) {
    this._host_map[designation] = [ address, port ];
    this._bus.post("status.ioudp.hostmap", this._host_map);
};

module.exports = IO_UDP;


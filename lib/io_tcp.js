var net    = require("net");

function IO_TCP(bus) {
    this._bus         = bus || function() {throw "IO_TCP needs a bus to work with";}();
    this._connections = [];
    
    var io = this;
    return function(f) {
        f(io);
        return io;
    };
}

IO_TCP.prototype.start = function(port) {
    var io = this;
    
    net.createServer(function (socket) {
        function endConnection() {
            io._bus.post("io.tcp.end", { name: socket.name });
            io._connections.splice(io._connections.indexOf(socket), 1);
        }
        
        socket.name = socket.remoteAddress + ":" + socket.remotePort;
        socket.buffer = "";
        socket.setKeepAlive(true, 2000);
        
        // Put this new client in the list
        io._connections.push(socket);
        io._bus.post("io.tcp.new", { address : socket.remoteAddress, port : socket.remotePort });
        
        // Handle incoming messages from clients.
        socket.on('data', function (data) {
            socket.buffer += data;
            if(socket.buffer.indexOf("\n") > 0) {
                var messages = socket.buffer.split("\n");
                messages.forEach(function(msg) {
                    io._tcpToBus(socket, msg);
                });
                socket.buffer = messages.length > 1 ? messages[messages.length - 1] : "";
            }
        });
        
        socket.on('error', endConnection);
        socket.on('end', endConnection);
    }).listen(port);
    
    io._bus.listen("io.tcp.ping", function(type, time, msg) {
        io._connections.filter(function(connection) {
            return msg.name === undefined || connection.name === msg.name;
        }).forEach(function(connection) {
            connection.write(JSON.stringify({ type: "io.tcp.ping", time: Date.now(), msg:{} }) + "\n");
        });
    });
};

IO_TCP.prototype._tcpToBus = function(socket, message) {
    try {
        var msg = JSON.parse(message);
        if(msg.type !== undefined && msg.msg !== undefined) {
            switch(msg.type) {
                case "io.tcp.name": if(msg.msg.name !== undefined) {
                    socket.name = msg.msg.name;
                    this._bus.post("io.tcp.name", { address : socket.remoteAddress, port : socket.remotePort, name: socket.name });
                }
                break;
                
                default: this._bus.post(msg.type, msg.msg); break;
            }
        }
    } catch(e) {
        // whatever
    }
};

IO_TCP.prototype.listen = function(type, translator) {
    translator = translator || function(type, time, msg) { return JSON.stringify({ type: type, time: time, msg: msg }) + "\n"; };
    
    var io = this;
    io._bus.listen(type, function(type, time, msg) {
        var payload = translator(type, time, msg);
        io._connections.forEach(function (client) { 
            try {
                client.write(payload); 
            } catch(e) {
                // need to introduce logging
            }
        });
    });
};


module.exports = IO_TCP;


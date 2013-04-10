
var events = require('events');


function Bus() {
    this._emitter = new events.EventEmitter();
    this._totalListeners = 0;
}

Bus.prototype.listen = function(msgtype, listener) {
    var result = function() {};
    
    var io = this;
    var emitter = this._emitter;
    if(typeof listener === 'function') {
        if(typeof msgtype === 'string') {
            emitter.addListener(msgtype, listener);
            
            io._totalListeners += 1;
            result = function() { 
                emitter.removeListener(msgtype, listener); 
                io._totalListeners -= 1;
            };
        } else if(msgtype instanceof Array) {
            msgtype.forEach(function(e) { emitter.addListener(e, listener); });
            
            this._totalListeners += msgtype.length;
            result = function() {
                msgtype.forEach(function(e) { emitter.removeListener(e, listener); });
                io._totalListeners -= msgtype.length;
            };
        } else if(msgtype instanceof Function) {
            var filteredListener = function(type, time, msg) {
                if(msgtype(type, time, msg)) listener(type, time, msg);
            };
            emitter.addListener("_all", filteredListener);
            
            this._totalListeners += 1;
            result = function() {
                emitter.removeListener("_all", filteredListener); 
                io._totalListeners -= 1;
            };
        }
    }
    
    return result;
};

Bus.prototype.peek = function(msgtype, listener) {
    var emitter = this._emitter;
    if(typeof listener === 'function' && typeof msgtype === 'string') {
        emitter.once(msgtype, listener);
    }
}

Bus.prototype.post = function(msgtype, msg, callback) {
    if(typeof msg === "string") {
        try {
            msg = JSON.parse(msg);
        } catch(err) {
            // do nothing, we asume that the message was not JSON after all
        }
    } else if(msg === undefined || msg === null) {
        return;
    }
    
    var emitter = this._emitter;
    var time = Date.now();

    emitter.emit("_all" , msgtype, time, msg);
    emitter.emit(msgtype, msgtype, time, msg);
};

module.exports = Bus;

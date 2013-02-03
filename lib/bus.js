
var events = require('events');


function Bus() {
    this._emitter = new events.EventEmitter();
}

Bus.prototype.listen = function(msgtype, listener) {
    var result = function() {};
    
    var emitter = this._emitter;
    if(typeof listener === 'function') {
        if(typeof msgtype === 'string') {
            emitter.addListener(msgtype, listener);
            
            result = function() { emitter.removeListener(msgtype, listener); };
        } else if(msgtype instanceof Array) {
            msgtype.forEach(function(e) { emitter.addListener(e, listener); })
            result = function() {
                msgtype.forEach(function(e) { emitter.removeListener(e, listener); })
            };
        } else if(msgtype instanceof Function) {
            var filteredListener = function(type, time, msg) {
                if(msgtype(type, time, msg)) listener(type, time, msg);
            };
            emitter.addListener("_all", filteredListener);
            result = function() { emitter.removeListener("_all", filteredListener); };
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


var events = require('events');


function Bus() {
    this._emitter = new events.EventEmitter();
}

Bus.prototype.listen = function(msgtype, listener) {
    var result = function() {};
    
    var emitter = this._emitter;
    if(typeof listener === 'function' && typeof msgtype === 'string') {
        emitter.addListener(msgtype, listener);
        
        result = function() { emitter.removeListener(msgtype, listener); };
    }
    
    return result;
};

Bus.prototype.post = function(msgtype, msg, callback) {
    if(typeof msg === "string") {
        try {
            msg = JSON.parse(msg);
        } catch(err) {
            // do nothing, we asume that the message was not JSON after all
        }
    }
    
    var emitter = this._emitter;
    var time = Date.now();

    emitter.emit("_all" , msgtype, time, msg);
    emitter.emit(msgtype, msgtype, time, msg);
};

module.exports = Bus;

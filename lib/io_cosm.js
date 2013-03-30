var cosm = require("cosm");

function IO_COSM(bus, api_key, feed_id) {
    this._bus    = bus                               || function() {throw "IO_TCP needs a bus to work with";}();
    this._client = new cosm.Cosm(api_key             || function() {throw "IO_TCP needs a COSM API key";}());
    this._feed   = new cosm.Feed(cosm, { id: feed_id || function() {throw "IO_TCP needs a COSM feed id";}() });
    
    var io = this;
    return function(f) {
        f(io);
        return io;
    };
}

IO_COSM.prototype.listen = function(type, translator, stream_id) {
    if(type       === null) throw "Message type is mandatory";
    if(translator === null) throw "Translator is mandatory";
    if(stream_id  === null) throw "Stream ID is mandatory";
    
    var io = this;
    io._bus.listen(type, function(type, time, msg) {
        var payload = translator(type, time, msg);
        io.post(stream_id, time, payload);
    });
};

IO_COSM.prototype.post = function(stream_id, time, value) {
    if(stream_id  === null) throw "Stream ID is mandatory";
    if(value  === null) throw "Value is mandatory";
    
    var stream = new cosm.Datastream(this._client, this._feed, { id: stream_id });
    stream.addPoint(value, time === null ? new Date() : new Date(time));
};


module.exports = IO_COSM;


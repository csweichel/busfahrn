
var redis = require('redis');

function _setupGarbageCollection(client, maxTTL) {
    setInterval(function() {
        client.keys("*.set", function(err, res) {
            (res || []).forEach(function(e) {
                client.zremrangebyscore(e, 0, (Date.now() / 1000) - maxTTL());
            });
        });
    }, 30 * 1000);
}

function IO_Redis(bus, host, port) {
    this._bus       = bus;
    this._client    = redis.createClient(port, host);
    this._defaultTTL = 60 * 60; // in seconds
    this._ttlMap    = {};
    
    var io = this;
    return function(f) {
        io._client.on("ready", function() { 
            _setupGarbageCollection(io._client, function() {
                return Object.keys(io._ttlMap).map(function(e) { return io._ttlMap[e]; }).reduce(function(x, y) { return Math.max(x, y); }, io._defaultTTL);
            });
            f(io); 
        });
        return io;
    };
}

IO_Redis.prototype.setDefaultTTL = function(ttl) {
    this._defautTTL = ttl;
};

IO_Redis.prototype.setTTL = function(msgtype, ttl) {
    this._ttlMap[msgtype] = ttl;
};

IO_Redis.prototype.listen = function(msgtype) {
    var io = this;
    this._bus.listen(msgtype, function(msgtype, time, msg) {
        var key = msgtype + ":" + time;
        var ttl = io._ttlMap[msgtype] || io._defaultTTL;
        
        io._client.mset(key, JSON.stringify(msg));
        if(ttl > 0) io._client.expire(key, ttl);
        io._client.zadd(msgtype + ".set", time, key);
    });
};

// not working correctly
IO_Redis.prototype.latest = function(msgtype, callback, limit) {
    limit = Math.max(limit || 1, 1);
    
    var io = this;
    io._client.zrevrangebyscore([ msgtype + ".set", '+inf', 0, 'LIMIT', 0, limit ], function(err, res) {
        if(res && res.length > 0) {
            var keys = res;
            io._client.mget(keys, function(err, res) {
                var result = res.filter(function(e) { return e !== null; }).map(function(val, idx) {
                    try {
                        return { time: parseInt(keys[idx].split(":")[1], 10), msg: JSON.parse(val) };
                    } catch(e) {
                        return val;
                    }
                });
                callback(null, result);
            });
        } else if(err) {
            callback(err, null);
        } else {
            callback(null, []);
        }
    });
};

module.exports = IO_Redis;

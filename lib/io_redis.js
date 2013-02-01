
var redis = require('redis'),
    util  = require('util');

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
    this._strategyMap = [];
    
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

IO_Redis.prototype.listen = function(msgtype, strategies) {
    strategies.forEach(function(strategy) {
        if(!util.isRegExp(strategy[0])) 
            throw "first part of strategy is not a regular expression";
        if(strategy.length != 2) 
            throw "strategy does not have two elements";
        if(strategy[1] === undefined) 
            throw "strategy does not have an implementation";
        if(!strategy[1].hasOwnProperty("store") || !(strategy[1].store instanceof Function))
            throw "second part of strategy does not have a store function";
        if(!strategy[1].hasOwnProperty("retrieve") || !(strategy[1].retrieve instanceof Function))
            throw "second part of strategy does not have a retrieve function";
    });
    if(strategies !== undefined)
        this._strategyMap = this._strategyMap.concat(strategies);
    
    var io = this;
    this._bus.listen(msgtype, function(msgtype, time, msg) {
        var storageStrategy = IO_Redis.Strategy.default.store;
        io._strategyMap.every(function(candidate) {
            if(candidate[0].test(msgtype)) {
                storageStrategy = candidate[1].store;
                return false;
            }
            return true;
        });
        
        storageStrategy(io, msgtype, time, msg);
    });
};

IO_Redis.Strategy = function() {};
IO_Redis.Strategy.none = {
    store    : function(io, type, time, msg) {},
    retrieve : function(io, msgtype, callback, limit) {}
};
IO_Redis.Strategy.default = {
    store : function(io, type, time, msg) {
        var key = type + ":" + time;
        var ttl = io._ttlMap[type] || io._defaultTTL;
        
        io._client.mset(key, JSON.stringify(msg));
        if(ttl > 0) io._client.expire(key, ttl);
        io._client.zadd(type + ".set", time, key);
    },

    // not working correctly
    retrieve : function(io, msgtype, callback, limit) {
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
    }
};
IO_Redis.Strategy.status = {
    store : function(io, type, time, msg) {
        var ttl = io._ttlMap[type] || 0;
        
        io._client.mset(type, JSON.stringify({ time: time, msg: msg }));
        if(ttl > 0) io._client.expire(type, ttl);
    },
    retrieve : function(io, msgtype, callback, limit) {
        io._client.mget(msgtype, function(err, res) {
            if(res && res.length > 0) {
                callback(null, res.map(function(msg) { return JSON.parse(msg); }));
            } else if(err) {
                callback(err, null);
            } else {
                callback(null, []);
            }
        });
    }
};
IO_Redis.Strategy.timeseries = {
    store : function(io, type, time, msg) {
        io._client.zadd(type, time, JSON.stringify({ time: time, msg: msg }));
    },
    retrieve : function(io, msgtype, callback, limit) {
        io._client.zrevrangebyscore(msgtype, "+inf", "-inf", function(err, res) {
            if(res && res.length > 0) {
                callback(null, res.map(function(msg) { return JSON.parse(msg); }));
            } else if(err) {
                callback(err, null);
            } else {
                callback(null, []);
            }
        });
    }
};


IO_Redis.prototype.latest = function(msgtype, callback, limit) {
    limit = Math.max(limit || 1, 1);
    
    var io = this;
    var retrievalStrategy = IO_Redis.Strategy.default.retrieve;
    io._strategyMap.every(function(candidate) {
        if(candidate[0].test(msgtype)) {
            retrievalStrategy = candidate[1].retrieve;
            return false;
        }
        return true;
    });
    retrievalStrategy(io, msgtype, callback, limit);
};

module.exports = IO_Redis;

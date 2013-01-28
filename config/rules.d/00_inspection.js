
module.exports = function(inference, bus, redis) {
    
    inference.rule("inspection_latest").on("inspection.latest").then(function(msgtype, time, msg, proceeding) {
        redis.latest(msg.type, function(err, res) {
            bus.post("inspection.latest." + msg.type, res);
        }, msg.limit || 1);
    }).enforce();
    
};


module.exports = function(inference, bus, redis) {
    
    inference.rule("inspection_latest").on("inspection.latest").then(function(msgtype, time, msg, proceeding) {
        redis.latest(msg.type, function(err, res) {
            console.log(JSON.stringify(res));
        }, msg.limit || 1);
    }).enforce();
    
};

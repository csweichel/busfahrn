#!/usr/bin/env node

var crypto  = require('crypto'),
    request = require('request'),
    argv    = require('optimist').argv;
    
function printUsage() {
    console.error("usage: listen_message (-h|--host <host> -u|--user <user> -p|--password <pwd> || -l|--local) -t|--type <msgtype> [-o|--once <function>]");
    console.error("\t-h|--host <host>   \ta host address, including http/https and port if neccesary");
    console.error("\t-u|--user <user>   \tthe username to login with");
    console.error("\t-p|--password <pwd>\tthe users password");
    console.error("\t-t|--type <msgtype>\ta message type to search for");
    console.error("\t[-l|--limit <limit>]\tthe number of last messages to search for");
    console.error("\t[-m|--map <function>]\toptional - if used, the Javascript function given is used to map the inspection result");
    console.error("\t[-r|--reduce <function>]\toptional - if used, the map result is fed here - this function has to use console.log and not return stuff");
    
    process.exit(-1);
}

var host, user, pass;
var local= argv.local    || argv.l || false;
if(local) {
    var config = require(__dirname + '/../config/httpserver.json');
    host = "https://localhost:" + config.server.port;
    user = Object.keys(config.auth)[0];
    pass = config.auth[user];
} else {
    host = argv.host     || argv.h || printUsage();
    user = argv.user     || argv.u || printUsage();
    pass = argv.password || argv.p || printUsage();    
}
var type = argv.type     || argv.t || printUsage();
var limit = argv.limit   || argv.l || 1;
var map  = argv.map      || argv.m || "function(rows) { return rows; }";
var reduce = argv.map    || argv.r || "function(rows) { console.log(JSON.stringify(rows)); }";

function queryInspection() {
    var payload = JSON.stringify({
        type: "inspection.latest",
        msg: {
            type: type,
            limit: limit
        },
        time: Math.floor(Date.now() / 1000)
    });
    var hash = crypto.createHmac("sha1", pass).update(payload).digest("hex");
    var url  = host + "/" + user + "/" + hash;
    
    request(url, {body:payload, method:"post"}, function(err, res, body) { });
}

function listenForResult() {
    var timestamp = Math.floor(Date.now() / 1000);
    var hash = crypto.createHmac("sha1", pass).update(timestamp + "inspection.latest." + type).digest("hex");
    var url  = host + "/" + user + "/" + hash + "/" + timestamp + "/inspection.latest." + type;
    
    var codeWellRunThroughEval = "map = " + map;
    try {
        eval(codeWellRunThroughEval);
    } catch(e) {
        console.error("Error while evaluating the map function:\t\n" + codeWellRunThroughEval + "\n" + e);
        process.exit(-1);
    }
    codeWellRunThroughEval = "reduce = " + reduce;
    try {
        eval(codeWellRunThroughEval);
    } catch(e) {
        console.error("Error while evaluating the reduce function:\t\n" + codeWellRunThroughEval + "\n" + e);
        process.exit(-1);
    }
    
    request(url).on('data', function(data) {
        if(data.toString().trim().length > 0) {
            var msg = JSON.parse(data);
            reduce(map(msg.msg));
            process.exit(0);
        }
    });
}

listenForResult();
queryInspection();

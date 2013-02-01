#!/usr/bin/env node

var crypto  = require('crypto'),
    request = require('request'),
    argv    = require('optimist').argv;
    
function printUsage() {
    console.error("usage: listen_message (-h|--host <host> -u|--user <user> -p|--password <pwd> || -l|--local) -t|--type <msgtype> [-o|--once <function>]");
    console.error("\t-h|--host <host>   \ta host address, including http/https and port if neccesary");
    console.error("\t-u|--user <user>   \tthe username to login with");
    console.error("\t-p|--password <pwd>\tthe users password");
    console.error("\t-t|--type <msgtype>\ta message type to listen for, can also be _all");
    console.error("\t[-o|--once <function>]\toptional - if used, the Javascript function given is used to determine when to terminate the program");
    
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
var once = argv.once     || argv.o || "function(type, time, msg) { return false; }";
    
var timestamp = Math.floor(Date.now() / 1000);
var hash = crypto.createHmac("sha1", pass).update(timestamp + type).digest("hex");
var url  = host + "/" + user + "/" + hash + "/" + timestamp + "/" + type;

var codeWellRunThroughEval = "var shouldExit = " + once;
try {
    eval(codeWellRunThroughEval);
} catch(e) {
    console.error("Error while evaluating the once function:\t\n" + codeWellRunThroughEval + "\n" + e);
    process.exit(-1);
}

console.log("listening on " + url);

//request(url).pipe(process.stdout);
request(url).on('data', function(data) {
    console.log(data.toString());
    if(data.toString().trim().length > 0) {
        var msg = JSON.parse(data);
        if(shouldExit(msg.type, msg.time, msg.msg)) {
            process.exit(0);
        }
    }
});

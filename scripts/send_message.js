#!/usr/bin/env node

var crypto  = require('crypto'),
    request = require('request'),
    argv    = require('optimist').argv;
    
function printUsage() {
    console.log("usage: send_message -h|--host <host> -u|--user <user> -p|--password <pwd> -t|--type <msgtype> -m|--message <msg>");
    process.exit(-1);
}

var host = argv.host     || argv.h || printUsage();
var user = argv.user     || argv.u || printUsage();
var pass = argv.password || argv.p || printUsage();
var msg  = argv.message  || argv.m || printUsage();
var type = argv.type     || argv.t || printUsage();
    

var json;
try {
    json = JSON.parse(msg);
} catch(err) {
    console.log("Message is not valid JSON: " + err);
    process.exit(-1);
}

var payload = JSON.stringify({
    type: type,
    msg: json,
    time: Math.floor(Date.now() / 1000)
});
var hash = crypto.createHmac("sha1", pass).update(payload).digest("hex");
var md5  = crypto.createHash("md5").update(payload).digest("hex");
var url  = host + "/" + user + "/" + hash;

console.log("POST " + url + " WITH " + payload + " MD5 " + md5);
request(url, {body:payload, method:"post"}, function(err, res, body) {
    console.log("ERR:  " + err);
    console.log("RES:  " + res);
    console.log("BODY: " + body);
});

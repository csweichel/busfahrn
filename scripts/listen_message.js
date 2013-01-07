#!/usr/bin/env node

var crypto  = require('crypto'),
    request = require('request'),
    argv    = require('optimist').argv;
    
function printUsage() {
    console.log("usage: listen_message -h|--host <host> -u|--user <user> -p|--password <pwd> -t|--type <msgtype>");
    process.exit(-1);
}

var host = argv.host     || argv.h || printUsage();
var user = argv.user     || argv.u || printUsage();
var pass = argv.password || argv.p || printUsage();
var type = argv.type     || argv.t || printUsage();
    
var timestamp = Math.floor(Date.now() / 1000);
var hash = crypto.createHmac("sha1", pass).update(timestamp + type).digest("hex");
var url  = host + "/" + user + "/" + hash + "/" + timestamp + "/" + type;

console.log("listening on " + url);

request(url).pipe(process.stdout);
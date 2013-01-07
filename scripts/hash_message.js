#!/usr/bin/env node

var crypto = require('crypto'),
    argv   = require('optimist').argv;
    
if (argv.password && argv.message) {
    console.log(crypto.createHmac("sha1", argv.password).update(argv.message).digest("hex"));
} else if (argv.d && argv.password) {
    var decipher = crypto.createDecipher("aes192", argv.password),
        msg = [];

    argv._.forEach( function (phrase) {
        msg.push(decipher.update(phrase, "hex", "binary"));
    });

    msg.push(decipher.final("binary"));
    console.log(msg.join(""));   
}


var express  = require('express'),
    fs       = require("fs"),
    https    = require("https");

var app = express();
app.use(function(req, res, next) {
    var data='';
    req.setEncoding('utf8');
    req.on('data', function(chunk) { 
       data += chunk;
    });

    req.on('end', function() {
        req.rawBody = data;
        
        if(req.method === "POST" && req.accepts('application/json') !== null) {
            try {
                req.body = JSON.parse(data);
                next();
            } catch(err) {
                res.send(500, err);
            }
        } else {
            next();
        }
    });
});

function IO_HTTPServer(bus, authenticator, max_timestamp_age) {
    max_timestamp_age = max_timestamp_age || 10;
    
    app.post('/:user/:hash', function(req, res) {
        if(!authenticator.mayPost(req.params.user, req.params.hash, req.rawBody) ||
            req.body.msg === null
          ) {
              res.send(403, "wrong authentication"); 
              res.end();
              return;
          }
          
        var body = req.body;
        if(!body.hasOwnProperty("type")) {
            res.send(500, { error: "missing message type" }); 
        } else if(!body.hasOwnProperty("msg")) {
            res.send(500, { error: "missing message" });
        } else if(!body.hasOwnProperty("time")) {
            res.send(500, { error: "missing timestamp" });
        } else if(body.time < ((Date.now() / 1000) - max_timestamp_age)) {
            res.send(500, { error: "timestamp too old" });
        } else {
            bus.post(req.body.type, req.body.msg, function(err) {
               console.log(err);
            });
            res.send({ done: true });
        }
    });
    
    app.get('/:user/:hash/:timestamp/:type', function(req, res) {
       if(!authenticator.mayListen(req.params.user, req.params.hash, req.params.timestamp + req.params.type)) {
            res.send(403, "wrong authentication"); 
            res.end();
            return;
       } else if(req.params.timestamp < ((Date.now() / 1000) - max_timestamp_age)) {
            res.send(500, { error: "timestamp too old", current_time: Math.floor(Date.now() / 1000 )});
            return;
       }
       
       res.socket.setTimeout(Infinity);
       res.writeHead(200, { 'Content-Type': 'application/json' });
       res.write("\n");
       var removeListener = bus.listen(req.params.type, function(msgtype, time, msg) {
           res.write(JSON.stringify({
               type: msgtype,
               msg : msg
           }));
           res.write("\n");
       });
       
        req.on("close", removeListener);
    });
}

IO_HTTPServer.prototype.start = function(port) {
    var privateKey  = fs.readFileSync(__config + 'server.key').toString();
    var certificate = fs.readFileSync(__config + 'server.crt').toString();
    var credentials = {key: privateKey, cert: certificate};
    var server = https.createServer(credentials, app);
    server.listen(port);
}

module.exports = IO_HTTPServer;

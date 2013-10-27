"use strict";
var express  = require('express'),
    hbs      = require('hbs'),
    fs       = require("fs"),
    https    = require("https"),
    http     = require("http"),
    xpath = require('xpath');

function IO_StructuredGUI(bus, ui_config) {
    this._app = express();
    this._bus = bus;
    this._config = ui_config;
}

IO_StructuredGUI.configFromXML = function(xml) {
    var items = {};
    xpath.select("//command", xml).map(function(cmd) {
        items[cmd.getAttribute('uid')] = {
            _type: 'command',
            label: cmd.getAttribute('label'),
            type: cmd.getAttribute('type'),
            message: JSON.parse(cmd.getAttribute('message') || cmd.nodeValue)
        };
    });
    xpath.select("//switch", xml).map(function(cmd) {
        items[cmd.getAttribute('uid')] = {
            _type: 'switch',
            label: cmd.getAttribute('label'),
            type: cmd.getAttribute('type'),
            key: cmd.getAttribute('key')
        };
    });
    xpath.select("//menu", xml).map(function(cmd) {
        if(!cmd.hasAttribute('uid'))  return;
        items[cmd.getAttribute('uid')] = {
            _menu: 'command',
            label: cmd.getAttribute('label'),
            ids: xpath.select("*[name() != 'menu']/@uid", cmd).map(function(uid) { return uid.value; })
        };
    });
    return { items: items };
}

IO_StructuredGUI.prototype.start = function(port, https) {
    var app = this._app;
    var ui_config = this._config;
    var bus = this._bus;
    var gui = this;
    
    app.all('/s/:id', function(req, res) {
        var id = req.params.id;
        
        if(ui_config.items.hasOwnProperty(id)) {
            var item = ui_config.items[id];
            var msgtype = item.type;
            
            bus.peek('inspection.latest.' + msgtype, function(type, time, msg) {
                if(msg.length == 1 && msg[0] !== null && msg[0] !== undefined) {
                   res.send(JSON.stringify({ 1: msg[0].msg[item.key || "command"] }));
                } else {
                    res.send(JSON.stringify({ '0' : 'no history' }));
                }
            });
            bus.post('inspection.latest', { type: msgtype, limit: 1 });
        }
    });
    app.all('/s/:id/:on', function(req, res) {
		var id = req.params.id;
        var on = req.params.on;
        
        if(ui_config.items.hasOwnProperty(id)) {
            var item = ui_config.items[id];
            var message = {};
            message[item.key || 'command'] = on === "on" ? 'on' : 'off';
            
            bus.post(item.type, message);
            res.send(JSON.stringify({ '1' : 'done' }));
        } else {
            res.send(JSON.stringify({ '0' : 'unknown item' }));
        }
    });
    
    app.all('/c/:id', function(req, res) {
		var id = req.params.id;
        
        if(ui_config.items.hasOwnProperty(id)) {
            var item = ui_config.items[id];
            bus.post(item.type, item.message);
            res.send(JSON.stringify({ '1' : 'done' }));
        } else {
            res.send(JSON.stringify({ '0' : 'unknown item' }));
        }
    });
        
    var server;
    if(https === undefined || https) {
        var privateKey  = fs.readFileSync(__config + 'server.key').toString();
        var certificate = fs.readFileSync(__config + 'server.crt').toString();
        var credentials = {key: privateKey, cert: certificate};
        server = https.createServer(credentials, app);
    } else {
        server = http.createServer(app);
    }
    server.listen(port);
    
    return this;
}

module.exports = IO_StructuredGUI;


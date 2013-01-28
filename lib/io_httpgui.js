"use strict";
var express  = require('express'),
    hbs      = require('hbs'),
    fs       = require("fs"),
    https    = require("https"),
    http     = require("http"),
    socketio = require('socket.io');

var app = express();

function IO_HTTPGui(bus, ui_config) {
    this._bus = bus;
    this._config = ui_config;
    
    app.set('view engine', 'hbs');
    app.engine('html', require('hbs').__express);
    app.set('views', __lib + 'aux/httpgui/templates');
    
    app.get('/', function(req, res) {
        hbs.registerHelper('type', function(whattype, options) {
            return (this.type == whattype) ? options.fn(this) : options.inverse(this);
        });
        
		res.render('index.html', { 'config' : ui_config });
    });

    app.get('/exec/:group/:id', function(req, res) {
		var grpid = req.params.group;
        var wdgid = req.params.id;
        
        for(var groupIdx in ui_config) {
            var group = ui_config[groupIdx];
            if(grpid != group.id) continue;
            
            for(var widgetIdx in group.widgets) {
                var widget = group.widgets[widgetIdx];
                if(wdgid != widget.id || widget.type !== 'action') continue;
                
                bus.post(widget.message.type, widget.message.body);
            }
        }
        
		res.send(JSON.stringify({ 'status' : 'done' }));
    });
    
    app.use('/metro', express.static(__lib + 'aux/httpgui/MetroUICSS/'));
    app.use('/knob', express.static(__lib + 'aux/httpgui/jQuery-Knob/js'));
    app.get('/js/jquery.js', function(req, res) { res.sendfile(__lib + 'aux/httpgui/jquery.min.js'); });
    
}

IO_HTTPGui.prototype.start = function(port, https) {
    var server;
    if(https === undefined || https) {
        var privateKey  = fs.readFileSync(__config + 'server.key').toString();
        var certificate = fs.readFileSync(__config + 'server.crt').toString();
        var credentials = {key: privateKey, cert: certificate};
        server = https.createServer(credentials, app);
    } else {
        server = http.createServer(app);
    }
    
    var io = socketio.listen(server);
    server.listen(port);
    
    io.configure(function() {
       io.disable('log'); 
    });
    
    var bus = this._bus;
    
    var events = [];
    var displays = [];
    for(var groupIdx in this._config) {
        var group = this._config[groupIdx];
        
        for(var widgetIdx in group.widgets) {
            var widget = group.widgets[widgetIdx];
            
            if(widget.type == 'action') {
                events.push(['action' + widget.id, function(type, msg) { return function(data) {
                    bus.post(type, msg);
                }; }(widget.message.type, widget.message.body)]);
            } else if(widget.type == 'range') {
                events.push(['rangeUpdate' + widget.id, function(type) { return function(data) {
                    bus.post(type, data);
                }; }(widget.message.type) ]);
                displays.push(['rangeUpdateView' + widget.id, widget.message.type]);
            } else if(widget.type == 'display') {
                displays.push(['display' + widget.id, widget.message.type]);
            }
        }
    }
    
    if(events.length > 0) {
        io.sockets.on('connection', function (socket) {
            for(var eventIdx in events) {
                var event = events[eventIdx];
                socket.on(event[0], event[1]);
            }
        });
    }
    if(displays.length > 0) {
        io.sockets.on('connection', function (socket) {
            var dereg = displays.map(function(disp) {
                return bus.listen(disp[1], function(type, time, msg) {
                    socket.emit(disp[0], { 'type': type, 'time': time, 'msg': msg });
                });
            });

            socket.on('disconnect', function() {
                dereg.forEach(function(deregisterListener) { deregisterListener(); });
            });
        });
    }
}

module.exports = IO_HTTPGui;


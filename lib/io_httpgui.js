
var express  = require('express'),
    fs       = require("fs"),
    https    = require("https");

var app = express();

function IO_HTTPGui(bus, ui_config) {
    app.get('/', function(req, res) {
		var cont = "<html><head><title>busfarhn</title></head><body><ul>";
		for(var id in ui_config) {
			cont += "<li><a href=\"/exec/" + id + "\">" + ui_config[id].label + "</a></li>\n";
		}
		cont += "</ul></body></html>";
        res.send(cont);
    });

    app.get('/exec/:id', function(req, res) {
		var id = req.params.id;
		if(ui_config.hasOwnProperty(id)) {
	        bus.post(ui_config[id].type, ui_config[id].msg, function(err) {
	        	console.log(err);
	        });
		}
		res.redirect('/');
    });
    
}

IO_HTTPGui.prototype.start = function(port) {
    var privateKey  = fs.readFileSync(__config + 'server.key').toString();
    var certificate = fs.readFileSync(__config + 'server.crt').toString();
    var credentials = {key: privateKey, cert: certificate};
    var server = https.createServer(credentials, app);
    server.listen(port);
}

module.exports = IO_HTTPGui;


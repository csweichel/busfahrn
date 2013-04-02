var Bus        = require('./lib/bus.js'),
    Inference  = require('./lib/inference.js'),
    IO         = require('./lib/io.js'),
    fs         = require('fs')
;

global.__root   = __dirname;
global.__lib    = __dirname + '/lib/';
global.__config = __dirname + '/config/';

process.on('uncaughtException', function(err) {
  console.log(err);
});

console.time("[STARTUP] ");
var main_bus = new Bus();

var io = new IO(main_bus);
io.load(__config + 'io.d/');

var history = io.get_module("history");
if(history === undefined) {
    console.log("inference support DISABLED as no history module is loaded");
} else {
    var inference = new Inference(main_bus, history);
    inference.load(__dirname + '/config/rules.d/');
}

{
    var rcdir = __config + 'rc.d/';
    fs.readdirSync(rcdir)
        .filter(function(file) { return file.charAt(0) !== "." && /js$/.test(file); })
        .sort()
        .forEach(function(file) {
            console.log("[RC.D] running " + file);
            require(rcdir + file)(main_bus);
        });
}


console.timeEnd("[STARTUP] ");


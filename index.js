var Bus        = require('./lib/bus.js'),
    Inference  = require('./lib/inference.js'),
    IO         = require('./lib/io.js')
;

global.__lib    = __dirname + '/lib/';
global.__config = __dirname + '/config/';


var main_bus = new Bus();

var io = new IO(main_bus);
io.load(__config + 'io.d/');

var inference = new Inference(main_bus);
inference.load(__dirname + '/config/rules.d/', io.get_module("history"));


var fs = require('fs');

function Inference(bus, history, rule_enforcement_strategy) {
    this._bus = bus;
    this._history = history;
    this._rule_enforcement = rule_enforcement_strategy;
    
    if(bus === undefined || bus === null)
        throw "No bus module supplied. Inference rules need a bus.";
    if(history === undefined || history === null)
        throw "No history module supplied. Inference rules need a history.";
}

Inference.prototype.rule = function(name) {
    var bus     = this._bus;
    var history = this._history;
    
    function Rule() { this.name = name; }
    Rule.prototype.on = function(type)   { this._on = type; return this; };
    Rule.prototype.uses = function(type) { this._uses = (this._uses || []); this._uses.push(type); return this; };
    Rule.prototype.when = function(when) { this._when = when; return this;  };
    Rule.prototype.then = function(then) { this._then = then; return this; };
    Rule.prototype.enforce = this._rule_enforcement || function() {
        var on = this._on || "_all";
        var uses = this._uses || [];
        var when = this._when || function(msgtype, time, msg, proceeding) { proceeding(); };
        var then = this._then;
        if(then === null) throw "rules need a consequence (forgot to call .then?)";

        var localizer = function() {
            var state = {};
            uses.forEach(function(type) {
                history.latest(type, function(err, res) {
                    if((res || []).length > 0) state[type] = res[0];
                }, 1);
                bus.listen(type, function(type, time, msg) { 
                    state[type] = { time: time, msg: msg };
                });
            });
            
            return function(type) {
                return state[type] || { };
            };
        }();

        var handler = function(msgtype, time, msg) {
            var continuation = {
                _         : localizer,
                _procceed : function(proceeding) {
                    continuation._then(msgtype, time, msg, proceeding);
                },
                _when     : when,
                _then     : then
            };
            continuation._when(msgtype, time, msg, continuation._procceed);
        };
        bus.listen(on, handler);
        
        console.log("[INFERENCE] enforcing " + this.name);
    };
    
    return new Rule();
};

Inference.prototype.load = function(dirname) {
    var inference = this;
    var bus       = this._bus;
    var history   = this._history;
    
    fs.readdirSync(dirname)
      .filter(function(file) { return file.charAt(0) !== "." && /js$/.test(file); })
      .sort()
      .map(function(file) { return dirname + file; })
      .forEach(function(file) {
          require(file)(inference, bus, history);
      });
};


module.exports = Inference;
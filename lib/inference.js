
var fs = require('fs');

function Inference(bus) {
    this._bus = bus;
}

Inference.prototype.rule = function(name) {
    var bus = this._bus;
    
    function Rule() { }
    Rule.prototype.on = function(type)   { this._on = type; return this; };
    Rule.prototype.when = function(when) { this._when = when; return this;  };
    Rule.prototype.then = function(then) { this._then = then; return this; };
    Rule.prototype.enforce = function() {
        var on = this._on || "_all";
        var when = this._when || function(msgtype, time, msg, proceeding) { proceeding(); };
        var then = this._then;
        if(then === null) throw "rules need a consequence (forgot to call .then?)";
        
        console.log("[INFERENCE] enforcing " + name);
        
        var handler = function(msgtype, time, msg) {
            when(msgtype, time, msg, function(proceeding) {
                then(msgtype, time, msg, proceeding);
            });
        };
        
        (typeof on === 'string' ? [on] : on).forEach(function(type) {
            bus.listen(type, handler);
        });
    };
    
    return new Rule();
};

Inference.prototype.load = function(dirname, history) {
    if(history === undefined || history === null)
        throw "No history module supplied. Inference rules need a history.";
    
    var inference = this;
    var bus       = this._bus;
    
    fs.readdirSync(dirname)
      .filter(function(file) { return file.charAt(0) !== "." && /js$/.test(file); })
      .map(function(file) { return dirname + file; })
      .forEach(function(file) {
          require(file)(inference, bus, history);
      });
};


module.exports = Inference;
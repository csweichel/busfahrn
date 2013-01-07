
var fs = require('fs');
var filenameConvention = /[\d{2}|\w{2}]_(\w+)\.js$/;

function IO(bus) {
    this._bus = bus;
    this._modules = {};
}

IO.prototype.load = function(dirname) {
    function isValidLoader(loader) {
        return true;
    }
    function getModuleName(filename) {
        var result;
        
        if(filenameConvention.test(filename)) {
            result = filenameConvention.exec(filename)[1];
        } else {
            result = filename;
        }
        
        return result;
    }
    
    var bus = this._bus;
    var io  = this;
    
    fs.readdirSync(dirname)
      .filter(function(file) { return file.charAt(0) !== "." && filenameConvention.test(file); })
      .forEach(function(file) {
          var fq_file = dirname + file;
          var loader = require(fq_file);
          if(isValidLoader(loader)) {
              var moduleName = getModuleName(file);
              io._modules[moduleName] = loader(bus, io);
              console.log("[IO] loading " + fq_file + " as " + moduleName);
          } else {
              console.log("[IO] not loading " + fq_file + ". Invalid loader function, should be function(bus, io) -> module.");
          }
      });
};

IO.prototype.get_module = function(name) {
    return this._modules[name];
};

module.exports = IO;


var io_structuredgui  = require(__lib + 'io_structuredgui.js'),
    dom = require('xmldom').DOMParser,
    fs = require('fs');

module.exports = function(bus, modules) {
    var config = fs.readFileSync(__config + 'structuredgui.xml').toString();
    var xml = new dom().parseFromString(config);
    
    return new io_structuredgui(bus, io_structuredgui.configFromXML(xml)).start(9000, false);
};

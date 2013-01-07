busfahrn - a simple message bus
============================
Busfahrn (colloquial German for _bus ride_) is a simple, pub/sub style message bus with a ton of IO support. Messages passed on the bus have a _message type_, a Unix _timestamp_, and a JSON _message body_. The main features of this bus are:

* A lot of IO modules to pass along messages. Out of the box support exists for HTTP(S), Redis, serial ports and the console.
* A notion of message/state inference using redis and simple rules formulated in JavaScript
* Clean and simple code, easy to extend and modify
* Written entirely in Node.JS

## Installation
All one needs to do to install busfahrn is downloading it from github and run ''npm install'':
```
git clone https://github.com/32leaves/busfahrn.git busfahrn
cd busfahrn && npm install
```

By default busfahrn comes with a set of IO modules enabled, some of which need configuration. The HTTP server module needs
its authentication configured (see HTTPServer module subsection), and the history module assumes a Redis server running on localhost. Also you might want to add some inference rules, as described in the inference section.

All configuration goes in the <tt>config</tt> directory:
```
config
   |- io.d/
   |- rules.d/
   |- httpserver.json
   |- server.crt
   |- server.key
```
The two directories contain the IO and inference configuration/initialization scripts which are loaded on startup - see the IO and Inference sections for more detail. In <tt>httpserver.json</tt> one can find the configuration for the http server module which is started by default. This configuration also contains username/password combinations for authentication. The <tt>server.crt, server.key</tt> files are certificates used by the http server to server HTTPS.

## To use
```
node index.js
```

# Core
At the core, _busfahrn_ is simply a wrapper for the NodeJS [EventEmitter](http://nodemanual.org/latest/nodejs_ref_guide/events.html). All messages going over the bus are a triplet of <tt>[msgtype, time, msg]</tt>.
* Message types (_msgtype_) are strings of the form <tt>this.is.an.id</tt> (an arbitrary amount of segments seperated by dots), except for system messages which start with an underscore and consist of only one segment.
* The time comes as a timestamp in milliseconds since epoch (Unix timestamp = time / 1000).
* Messages themselves can be arbitrary JavaScript objects. However, they're likely to be de/seralized from and to JSON using <tt>JSON.stringify</tt> and <tt>JSON.parse</tt> which in effect limits messages to basic types.


The _Bus_ module sports the following API: <ul><li> __listen(msgtype, listener)__: Add a listener to the bus, listening for messages of _msgtype_. The _msgtype_ can be a string, an array or a 1-ary filter function. If _msgtype_ is a string, it is considered a message type identifier. If it's an array, it's considered a list of message type IDs and if it's a function, it is used as a filter. There is a special _msgtype_ that allows clients to listen to all messages on the bus: <b><tt>\_all</tt></b>. Listeners are functions with a signature of <tt>function(msgtype, time, msg) { }</tt>. Registering a listener, results in a function that can be used to unregister the listener, hence stop listening to the bus - see the example on how to use this.
```
// EXAMPLE
var main_bus = new Bus();

// listening to all events on the bus
main_bus.listen("_all", function(msgtype, time, msg) {
	console.log(time + ", " + msgtype + " :: " + JSON.stringify(msg)); 
});

// listening to _sensors.hallway.pir_ and _sensors.hallway.door_ events only
var removeHallwayListeners = 
	main_bus.listen(["sensors.hallway.pir", "sensors.hallway.door"], function(msgtype, time, msg) {
		console.log("Something's happening in the hall"); 
	});

// stop listening to the hallway sensors
removeHallwayListeners();

// listening to events starting with _sensor._
main_bus.listen(function(msgtype) {
	return /^sensors\./.test(msgtype);
}, function(msgtype, time, msg) {
	console.log("The sensors are talking"); 
});
```
</li><li>__post(msgtype, msg)__: Posts a message on the bus. The _msgtype_ must a valid message type string (see above). Messages ( _msg_ ) can be either a string or a JSONifiable object.
```
// EXAMPLE
var main_bus = new Bus();
main_bus.post("sensors.hallway.temp", { temperature: 25.7, humidity: 0.3, light: 0.7 });
```
</li>


</ul>

# IO support
Getting messages from and to the bus is handled in IO drivers. Those drivers do not follow a specific interface, however, the default ones are all written using the same convention, described below.

## default IO drivers
### Redis
The Redis driver can store messages in a [Redis key/value store](http://redis.io/) for later reference, e.g. in the inference module. Each message is stored with <tt>msgtype:time</tt> as key and the JSONified message body as value. Additionally, for each message type a sorted set is maintained that contains the message keys of that type as value and their timestamp as score, allowing efficient time-dependent queries (e.g. the latest 5 messages of type <tt>x.y.z</tt>).

The messages passed on the bus might not be valid forever - e.g. in a home automation context, a temperature reading is likely to be wrong an hour later. To invalidate such messages, all stored messages can be set to expire after some time has passed. There is a default _time to live_ (1 hour), but the TTL can also be configured per message type. To disable message invalidation, the TTL is set to zero.

This driver supports not only storing messages in the database, but also has some rudimentary querying support:
* __IO\_Redis(bus, [host, port])__: Creates a new instance of the Redis driver. The _bus_ is expected to be an instance of the Bus core class. If no host/port is given, localhost and the Redis default port are assumed.

        // EXAMPLE
        var io_redis = require(__lib + 'io_redis');
        var redis = io_redis(main_bus)(function(io) {
	        // do something with the driver
        });
* __listen(msgtype)__: Listens for messages matching a certain message type and stores them in the database as described above.</li>
* __setDefaultTTL(ttl)__, __setTTL(msgtype, ttl)__: Sets the _time to live_ in seconds for either all messages or for specific types. The _msgtype_ has to be a string identifier. Setting any of these values to zero will disable the message invalidation for that kind of message.
* __latest(msgtype, callback[, limit])__: Queries the database for the last few messages of a certain type and passes a list of found messages to the _callback_. The _msgtype_ has to be a string identifier. If no limit is given, only that last message is returned (limit = 1).

        // EXAMPLE
        redis.latest("sensors.hallway.pir", function(err, res) {
        	if(err) {
        		console.log("Error while querying the database: " + err);
        	} elseif(res.length == 0) {
        		console.log("No PIR info available");
        	} else {
        		console.log("Latest PIR info: " + res[0].msg.status);
        	}
        });

### HTTP server
This driver spawns a HTTPS server which supports passing messages to and from the bus. It uses a simple, SHA1-Hmac based method for authentication and message verification. The HTTPS driver is slightly different than the other drivers in that it provides full access to the bus. So, e.g. selecting which messages to listen to is done via the URL and not programmatically while spawning the server. When creating an instance of this driver, an _Authenticator_ instance has to be passed which is used to authenticate users. A default Authenticator implementation that uses a hashmap as reference is available.
* __IO_HTTPServer(bus, authenticator[, max_timestamp_age])__: Creates a new HTTPServer instance, but does not spawn the server itself.
* __start(port)__: Spawns the HTTPS server itself. This method expects the <tt>config/server.crt</tt> and <tt>config/server.key</tt> files to be present.

        // EXAMPLE
        var io_httpserver = require(__lib + 'io_httpserver'),
        	authenticator = require(__lib + 'authenticator');
        var auth = new authenticator({ "userA" : "password", "userB" : "otherpwd" });
        new io_httpserver(main_bus, auth).start(8080);

The server supports listing to messages, as well as posting them. Both operations require a valid authentication. Posting messages to the bus can be done by sending a POST request to <tt>http://host:port/username/hmac_hash</tt> with the following JSON structure as request body:
```
{
	"type" : "msgtype",
	"time" : currentTimeStamp,
	"msg"  : {
		"can_be" : "anything"
	}
}
```
When hashing the this structure to create the _hmac\_hash_ part of the request URL, make sure you hash exactly the same string as you post. Otherwise the request is likely to be denied. The response is going to be a JSON structure with either a "done" or an "error" key, depending on if the request was successful.

To listen for messages of a given type (or \_all), the server will create an HTTP stream posting messages as JSON when they arrive on the bus. Sending a GET request to <tt>/username/hash/timestamp/type</tt> will open such a stream. The hash is again a SHA1-Hmac hash with the users password as secret and the concatenation of _timestamp_ and _time_. Examples of how to use this HTTP API can be found in the <tt>scripts/post_message.js</tt> and <tt>scripts/listen_message.js</tt> scripts.

### HTTP client
Instead of listing for messages, one might also want to post messages via HTTP; that's what the HTTP client is for. It's usage is straight forward:
* __IO_HTTPClient(bus, url[, method])__: Creates a new HTTPClient instance which is going to send events to the given url using the specified method. If no method (either POST or PUT) is specified, all messages will be sent via POST requests. The request body contains JSONified structures containing the _msgtype_, _time_ and _msg_. GET requests are not supported.
* __listen(msgtype[, callback])__: Adds a listener which performs a request per message. If a callback is used, it should have the signature <tt>function(err, res, body)</tt> and is called when after the HTTP request.

        // EXAMPLE
        var io_httpclient = require(__lib + 'io_httpclient');
        new io_httpclient(main_bus, "http://foobar.com/busevents")(function(io) {
        	io.listen(function(msgtype) { return /^sensors\./.test(msgtype); });
        	io.listen(["security.intruder", "security.authorizedUser"], function(err, res, body) {
        		if(err) {
        			console.log("Error while posting security events: " + err);
        		} else if(body) {
        			main_bus.post("security.reply", JSON.parse(body));
        		}
        	});
        });

### Serial port
Controlling embedded devices, such as an Arduino, is often done using serial ports over USB. This driver adds serial port support using the [serialport](https://github.com/voodootikigod/node-serialport) module. It provides special means for translating messages, as the JSON format typically used tends to be unsuited for embedded applications. Should the device which is connected to the other end of the serial port be disconnected, all listeners are automatically disconnected from the bus.
* __IO_SerialPort(bus, port[, baudrate])__: Creates a new serial port instance which will try to connect to _port_ straight away. The default baudrate is 9600.
* __connect([translator])__: Connects the serial device to the bus so that it can post messages to the bus. The default translator creates a message for each line received, splits that with whitespaces as delimiters and considers the first token to be the _msgtype_. So the line <tt>sensors.hallway.pir person</tt> would turn into <tt>{ msgtype: "sensors.hallway.pir", msg: "person" }</tt>. Translators are supposed to be functions with the signature <tt>function(data)</tt> and to return a hash with _type_ and _msg_ as keys.

        // EXAMPLE
        var io_serialport = require(__lib + 'io_serialport');
        new io_serialport(main_bus)(function(io) {
        	io.connect(function(data) {
        		return { type: "sensors.dummy", msg: data };
        	});
        });

* __listen(msgtype[, translator])__: Forwards messages matching _msgtype_ coming from the bus to the serial port, possibly translated using the _translator_. The default translator [JSONifies](http://nodemanual.org/latest/js_doc/JSON.html#JSON.stringify) messages. Translators passed to this function are supposed to have the signature <tt>function(msgtype, time, msg)</tt> and return a string.
        
        // EXAMPLE
        var io_serialport = require(__lib + 'io_serialport');
        new io_serialport(main_bus)(function(io) {
        	io.listen("actors.hallway.light", function(msgtype, time, msg) {
        		return msg.status == "on" ? "o" : "O";
        	});
        });



## configuring drivers
All IO driver configuration happens in the <tt>config/io.d</tt> folder, in which the initialization scripts are placed. By convention, those scripts are named <tt>NN_SomeIOName.js</tt> where _NN_ is a positive two-digit number (has to match <tt>[\d{2}|\w{2}]_(\w+)\.js$</tt>). Each initialization script is a NodeJS module and loaded using _require_. The module export is expected to be a function with a signature like <tt>function(bus, modules)</tt>, where _modules_ is an instance of the <tt>IO</tt> core class.
```
// EXAMPLE
var io_console = require(__lib + 'io_console.js');

module.exports = function(bus, modules) {
    return new io_console(bus)(function(io) {
        io.listen("_all");
    });
};
```
 The IO class handles the script loading and registers each instantiated IO driver for later reference. Each loaded IO module - the return value of an init script function - is registered with a name constructed from the filename. Suppose the filename was <tt>10_SomeIOName.js</tt>, the loaded driver would be registered as _SomeIOName_ (see the regular expression above; the group determines the module name). Previously registered IO drivers/modules can be retrieved from the IO class instance passed as _modules_ parameter:
 * __IO(bus)__: Creates a IO class instance which will operate on the given bus.
 * __get\_module(name)__: returns a previously loaded IO module named as given. If no such driver is registered, null is returned.
 * __load(directory)__: loads a set of init scripts from the _directory_ (e.g. <tt>config/io.d</tt>).


## writing your own / conventions used
IO drivers are just NodeJS modules, however, they follow a convention to make their usage straight forward. Below is a template for writing such a driver that should clarify the callback pattern involved. All out of the box IO drivers can be found in the <tt>lib</tt> directory and are named <tt>io_*.js</tt>.
```
function IO_Driver(bus, specificConfigParamOne) {
	this._bus = bus;
	this._specificConfigParamOne = specificConfigParamOne;

	var io = this;
	return function(f) {
		// if this IO driver did something asynchronous, call f in the callback
		f(io);
		return io;
	};
}

/**
 * The listen function typically connects the bus to the outside world.
 * As one might not be interested in forwarding all messages of the bus,
 * message types are used to filter.
 */
IO_Driver.prototype.listen = function(msgtype) {
	// do something to forward messages to the outside world
};

IO_Driver.prototype.connect = function() {
	// 	do something to push messages coming in onto the bus
};

module.exports = IO_Driver;
```

# Inference
Message inference is the concept of grouping a set of messages over time to infer a high-level context. E.g. if there were messages on a bus that a users phone connected to the WiFi and the door was opened with a specific key, we could infer that a user returned home, and post a message to the bus accordingly. Such a message would then trigger a set of actuators, that could turn on heating and start some form of music.

Inference in busfarhn is rather simple and does not incorporate powerful but complex rule systems like [nools](https://github.com/doug-martin/nools). It is assumed that most rules are of the form <tt>msg + previous_msgs + some_state -> new_message</tt>, where _some\_state_ is also a set of high-level messages that were posted on the bus. Hence, a time-based message history can provide the basis for inferring context. That history is provided by the Redis IO driver, which is started by default and passed to all rules. If there is no IO module named _history_, the inference rules are not loaded.

Writing a rule is a matter of placing a <tt>.js</tt> file in the <tt>config/rules.d</tt>. JavaScript files in that directory are expected to be modules, similar to IO drivers.
```
// EXAMPLE
module.exports = function(inference, bus, history) {

    inference
    .rule("descriptive_rule_name")
    .on("msgtype")
    .when(function(msgtype, time, msg, proceed) {
    	// a condition when to execute the rule. Call proceed to execute the then part.
	})
	.then(function(msgtype, time, msg, proceeding) {
		// ...
    })
    .enforce();
    
};
```
The example above demonstrates the structure of inference rules. All rules have a descriptive name that is mainly used for debugging purposes. The _on(msgtype)_ call is optional - if it is omitted, the _when_ condition is called for every message; _msgtype_ can be a string, array or a filter function. The _when_ condition decides whether taking action is required. The _msgtype, time, msg_ values passed here are the values of the message that triggered the rule evaluation. If action should be taken, the proceed function has to be called with an optional parameter. If _when_ called _proceed()_, the _then_ part is executed and the value passed to _proceed_ is passed along. Below is an example that would implement the rule from the beginning of this section (user returning home):
```
// EXAMPLE - user returning home
module.exports = function(inference, bus, history) {
	var msg_types = [ "wifi.phone.registered", "door.opened" ];
	
	inference
    .rule("user_returning_home")
    .on(msg_types)
    .when(function(msgtype, time, msg, proceed) {
		for(var i = 0; i < msg_types.length; i++) {
			var other = msg_types[(i + 1) % msg_types.length];

	    	history.latest(other, function(err, res) {
	    		if(res.length > 0 && res.msg.user_id === msg.user_id)
	    			proceed(msg.user_id);
	    	});
    	}
	})
	.then(function(msgtype, time, msg, proceeding) {
		var user_id = proceeding;

		bus.post("actuators.heating", { temperature: 25 });
		bus.post("media.music.playlist.by_user_id", user_id);
		bus.post("media.music.control", { command: "play" });
	})
    .enforce();

};
```

# Known issues
* HTTP authentication is suboptimal
* Bus message dispatch is synchronous / one listener can block the whole thing
* Need a better logging mechanism. So far everything is done using <tt>console.log</tt>.
* There is no synchronization mechanism during IO driver loading. If one driver uses another one, there is no way ensure that other driver is ready.

# License - "MIT License"
Copyright (c) 2013 Christian Weichel, 32leaves

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
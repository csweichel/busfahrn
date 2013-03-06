function installTerminal(io) {
    jQuery(document).ready(function($) {
        var cmds = {
            'is': {
                'desc'  : 'Checks for the latest messages of a certain type',
                'usage' : '<type> [count]',
                'parser': /([\w]+(\.[\w]+)*)([\s]+([\d]+))?/,
                'exec'  : function(term, args) {
                    socket.emit("io.httpgui.terminal.cmd", { type: "inspection.latest", msg: { type: args[1], limit: parseInt(args[3]) || 1 } });
                }
            },
            'send' : {
                'desc'  : 'Sends a JSON message to the bus',
                'usage' : '<type> <message>',
                'parser': /([\w]+(\.[\w]+)*)[\s]+(.+)/,
                'exec': function(term, args) {
                    var msg = JSON.parse(args[args.length - 1]);
                    socket.emit("io.httpgui.terminal.cmd", { type: args[1], msg: msg });
                }
            },
            'receive' : {
                'desc'  : 'Enables/disables receiving all messages sent on the bus',
                'usage' : 'on|off',
                'parser': /on|off/,
                'exec': function(term, args) {
                    if(args[0] === 'on') {
                        socket.emit('io.httpgui.terminal.enable', '');
                    } else {
                        socket.emit('io.httpgui.terminal.disable', '');
                    }
                    term.echo("Message reception is now [37;1m" + args + "[0m");
                }
            },
            'help' : {
                'exec': function(term, args) {
                    var commands = Object.keys(cmds);
                    term.echo("Available commands: " + commands.join(", "));
                    commands.forEach(function(command) {
                        term.echo("\t[31;1m" + command + "[0m - " + (cmds[command].desc || "n/a"));
                        if(cmds[command].hasOwnProperty("usage"))
                            term.echo("\t\tusage: " + command + " " + cmds[command].usage);
                    });
                }
            }
        };
        
        var term = $('#tilda').tilda(function(command, terminal) {
            var cmdsplit = command.split(" ");
            var cmd = cmdsplit[0];
            var argstring = cmdsplit.splice(1).join(" ");
            if(cmds.hasOwnProperty(cmd)) {
                var args = cmds[cmd].parser === undefined ? argstring : argstring.match(cmds[cmd].parser);
                if(args === null) {
                    term.echo("ERROR: invalid command: " + command);
                } else {
                    cmds[cmd].exec(term, args);
                }
            } else {
                term.echo("command not found: " + cmd);
            }
        }, {
            prompt: 'busfarhn> ',
            greetings: '[37;1mWelcome to busfarhn: die Fahrausweise bitte![0m If you don\'t know what to do, enter [31;1mhelp[0m',
            height: 400,
            activate: function(firstActivation) {
                if(firstActivation) socket.emit('io.httpgui.terminal.enable', '');
            }
        }).terminal;
        
        socket.on('io.httpgui.terminal.bus', function(data) {
            var type = data.type;
            var msg  = data.msg;
            
            term.echo('[33;1m[' + type + '] [37;1m' + JSON.stringify(msg));
        });
        socket.on('io.httpgui.terminal.error', function(data) {
            term.echo('ERROR: ' + data);
        });
    });
}
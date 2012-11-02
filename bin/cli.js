#!/usr/bin/env node
var seaport = require('../');
var spawn = require('child_process').spawn;
var fs = require('fs');

var argv = require('optimist').argv;
if (!argv._[0]) {
    return fs.createReadStream(__dirname + '/usage.txt').pipe(process.stdout);
}

if (typeof argv._[0] === 'number') {
    var port = argv._[0];
    
    var server = seaport.createServer(argv);
    server.listen(port);
    console.log('seaport listening on :' + port);
}
else {
    var s = argv._[0].split(':');
    var port = s[0];
    var host = s[1];
    
    var cmd = argv._[1];
    
    if (cmd === 'service') {
        var ports = seaport.connect(host, port, argv);
        ports.service(argv._[2], function respawn (port) {
            var ps = spawn(argv._[3], argv._.slice(4).concat(port));
            ps.stdout.pipe(process.stdout, { end : false });
            ps.stderr.pipe(process.stderr, { end : false });
            
            ps.on('exit', function () {
                setTimeout(respawn, 1000, port);
            });
        });
    }
    else if (cmd === 'query') {
        var ports = seaport.connect(host, port, argv);
        ports.query(argv._[2], function (ps) {
            console.log(JSON.stringify(ps.map(function (p) {
                return p.host + ':' + p.port
            })));
            ports.close();
        });
    }
    else if (cmd === 'show' || cmd === undefined) {
        var ports = seaport.connect(host, port, argv);
        ports.query(function (ps) {
            console.log(JSON.stringify(ps, undefined, 2));
            ports.close();
        });
    }
}

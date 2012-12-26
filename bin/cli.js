#!/usr/bin/env node
var seaport = require('../');
var spawn = require('child_process').spawn;
var fs = require('fs');

var argv = require('optimist').argv;
var cmd = argv._[0];

if (argv.v || argv.verion) {
    return console.log(require('../package.json').version);
}

if (!cmd || argv.h || argv.help) {
    return fs.createReadStream(__dirname + '/usage.txt')
        .pipe(process.stdout)
    ;
}

if (cmd === 'listen') {
    var port = argv.port || argv._[1];
    var opts = argv._.slice(1)
        .filter(function (x) { return !/^\d+$/.test(x) })
        .map(function (x) {
            return JSON.parse(fs.readFileSync(x, 'utf8'));
        })
        .reduce(function (acc, data) {
            if (Array.isArray(data)) {
                acc.authorized.push(data);
            }
            else {
                if (data.public) acc.public = data.public;
                if (data.private) acc.private = data.private;
            }
            return acc;
        }, { authorized : [] })
    ;
    
    var server = seaport.createServer(argv, opts);
    server.listen(port);
    console.log('seaport listening on :' + port);
    return;
}

if (cmd === 'query' || cmd === 'show') {
    var ports = seaport.connect(argv._[1]);
    var sync_count = 0
    ports.on('synced', function() {
        if (++sync_count == 2) {
            var ps = ports.query(argv._[2]);
            console.log(JSON.stringify(ps, null, 2));
            ports.close();
            clearTimeout(timeout);
        }
    });
    var timeout = setTimeout(function(){
        console.error('timed out');
        console.log('[]');
        ports.close();
    }, 1000)
    return;
}

if (cmd === 'register') {
    var ports = seaport.connect(argv._[1]);
    var opts = JSON.parse(argv.meta || '{}');
    opts.role = argv._[2];
    
    if (argv.key) opts.key = JSON.parse(fs.readFileSync(argv.key, 'utf8'));
    
    var port = ports.register(opts);
    
    (function respawn () {
        var ps = spawn(argv._[3], argv._.slice(4).concat(port));
        ps.stdout.pipe(process.stdout, { end : false });
        ps.stderr.pipe(process.stderr, { end : false });
        
        ps.on('exit', function () {
            setTimeout(respawn, 1000);
        });
    })();
}

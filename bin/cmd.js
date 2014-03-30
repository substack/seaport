#!/usr/bin/env node
var seaport = require('../');
var spawn = require('child_process').spawn;
var fs = require('fs');

var argv = require('optimist').argv;
var cmd = argv._[0];

if (argv.version) {
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
    ports.once('synced', function () {
        var ps = ports.query(argv._[2]);
        ps = ps.map(function (p) {
            for (var i = 3; i < argv._.length; i++) {
                p = p[argv._[i]];
                if (!p) break;
            }
            return p;
        });
        console.log(JSON.stringify(ps, null, 2));
        ports.close();
    });
    return;
}

if (cmd === 'watch') {
    var ports = seaport.connect(argv._[1]);
    ports.services.on('changes', function (row, ch) {
        var parts = [
            row.state.role + '@' + row.state.version,
            row.state.host + ':' + row.state.port,
            '[' + row.state.id + ']'
        ].join(' ');
        
        var keys = ch && Object.keys(ch);
        if (ch.type === null) {
            console.log('FREE ' + parts);
        }
        else if (keys.length === 1 && ch.type === 'service') {
            console.log('RECLAIM ' + parts);
        }
        else if (keys.length === 1 && ch.type === 'stale-service') {
            console.log('STALE ' + parts);
        }
        else if (keys.length === 1 && ch._heartbeat) {
            if (argv.vvv) console.log('HEARTBEAT ' + parts);
        }
        else {
            console.log('REGISTER ' + parts);
        }
        
        if (argv.v || argv.verbose) {
            console.log(JSON.stringify(row, null, 2)
                .split('\n')
                .map(function (line) { return '  ' + line })
                .join('\n')
            );
        }
    });
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

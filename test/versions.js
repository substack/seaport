var seaport = require('../');
var test = require('tap').test;

test('versions', function (t) {
    t.plan(5);
    
    var serverPort = Math.floor(Math.random() * 5e4 + 1e4);
    var server = seaport.createServer();
    server.listen(serverPort);
    
    var ports = [
        seaport.connect(serverPort),
        seaport.connect(serverPort),
        seaport.connect(serverPort),
    ];
    
    function onready () {
        var pending = 3;
        ports[0].get('beep', function (ps) {
            t.equal(ps.length, 3);
            if (--pending === 0) t.end();
        });
        
        ports[0].get('beep@1.2.x', function (ps) {
            t.equal(ps.length, 1);
            t.equal(ps[0].port, ports_['beep@1.2.3']);
            if (--pending === 0) t.end();
        });
        
        ports[0].get('beep@>1.2', function (ps) {
            t.equal(ps.length, 2);
            t.deepEqual(
                ps.map(function (p) { return p.port }).sort(),
                [ ports_['beep@1.2.3'], ports_['beep@1.3.5'] ].sort()
            );
            
            if (--pending === 0) t.end();
        });
    }
    
    var ports_ = {};
    var pending = 3;
    ports[1].service('beep@1.2.3', function (port, ready) {
        ports_['beep@1.2.3'] = port;
        ready();
        if (--pending === 0) setTimeout(onready, 50);
    });
    ports[1].service('beep@1.3.5', function (port, ready) {
        ports_['beep@1.3.5'] = port;
        ready();
        if (--pending === 0) setTimeout(onready, 50);
    });
    ports[2].service('beep@0.9.2', function (port, ready) {
        ports_['beep@0.9.2'] = port;
        ready();
        if (--pending === 0) setTimeout(onready, 50);
    });
    
    t.on('end', function () {
        server.close();
        ports[0].close();
        ports[1].close();
        ports[2].close();
    });
});

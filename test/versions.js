var seaport = require('../');
var tap = require('tap');
var test = tap.test;

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
    
    var ports_ = {
        'beep@1.2.3' : ports[1].register('beep@1.2.3'),
        'beep@1.3.5' : ports[1].register('beep@1.3.5'),
        'beep@0.9.2' : ports[2].register('beep@0.9.2'),
    };
    
    setTimeout(function () {
        ports[0].get('beep', function (ps) {
            t.equal(ps.length, 3);
        });
        
        ports[0].get('beep@1.2.x', function (ps) {
            t.equal(ps.length, 1);
            t.equal(ps[0].port, ports_['beep@1.2.3']);
        });
        
        ports[0].get('beep@>1.2.0', function (ps) {
            t.equal(ps.length, 2);
            t.deepEqual(
                ps.map(function (p) { return p.port }).sort(),
                [ ports_['beep@1.2.3'], ports_['beep@1.3.5'] ].sort()
            );
        });
    }, 150);
    
    t.on('end', function () {
        server.close();
        ports[0].close();
        ports[1].close();
        ports[2].close();
    });
});

tap.on('end', function() {
    process.exit();
});

var test = require('tap').test;
var seaport = require('../');

test('alloc and free', function (t) {
    t.plan(6);
    var port = Math.floor(Math.random() * 5e4 + 1e4);
    var server = seaport.createServer();
    
    var gotPort;
    server.once('allocate', function (alloc) {
        t.equal(gotPort, alloc.port);
        
        var ps = ports.query('http');
        t.equal(ps.length, 1);
        t.equal(ps[0].host, '127.0.0.1');
        t.equal(ps[0].port, gotPort);
        ports.close();
    });
    
    server.on('free', function () {
        ports = seaport.connect('localhost', port);
        
        server.once('allocate', function (alloc) {
            t.equal(alloc.port, gotPort);
            
            ports.close();
            server.close();
            t.end();
            setTimeout(function () {
                process.exit(); // whatever
            }, 100);
        });
        ports.allocate('http', gotPort);
    });
    
    server.listen(port);
    
    var ports = seaport.connect('localhost', port);
    
    ports.allocate('http', function (p) {
        t.ok(p >= 10000 && p < 65536);
        gotPort = p;
    });
});

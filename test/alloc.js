var test = require('tap').test;
var seaport = require('../');

test('alloc and free', function (t) {
    t.plan(6);
    var port = Math.floor(Math.random() * 5e4 + 1e4);
    var server = seaport.createServer();
    
    var gotPort;
    server.on('allocate', function (alloc) {
        t.equal(gotPort, alloc.port);
        
        ports.query('http', function (ps) {
            t.equal(ps.length, 1);
            t.equal(ps[0].host, '127.0.0.1');
            t.equal(ps[0].port, gotPort);
            ports.close();
        });
    });
    
    server.on('free', function () {
        ports = seaport.connect('localhost', port);
        ports.assume('http', gotPort);
    });
    
    server.on('assume', function (alloc) {
        t.equal(alloc.port, gotPort);
        
        ports.close();
        server.close();
        t.end();
        setTimeout(function () {
            process.exit(); // whatever
        }, 100);
    });
    
    server.listen(port);
    
    var ports = seaport.connect('localhost', port);
    
    ports.allocate('http', function (p) {
        t.ok(p >= 10000 && p < 65536);
        gotPort = p;
    });
});

var test = require('tap').test;
var seaport = require('../');

test('alloc and free', function (t) {
    t.plan(6);
    var port = Math.floor(Math.random() * 5e4 + 1e4);
    var server = seaport.createServer();
    
    var gotPort;
    server.once('register', function (alloc) {
        t.equal(gotPort, alloc.port);
        
        var ps = ports.query('http');
        t.equal(ps.length, 1);
        t.equal(ps[0].host, '127.0.0.1');
        t.equal(ps[0].port, gotPort);
        ports.close();
    });
    
    server.once('free', function () {
        ports = seaport.connect(port);
        
        server.once('register', function (alloc) {
            t.equal(alloc.port, gotPort);
        });
        ports.register('http', gotPort);
    });
    
    server.listen(port);
    
    var ports = seaport.connect(port);
    
    gotPort = ports.register('http');
    t.ok(gotPort >= 10000 && gotPort < 65536);
    
    t.on('end', function () {
        ports.close();
        server.close();
    });
    
});

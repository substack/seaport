var test = require('tap').test;
var seaport = require('../');

test('allocate with metadata', function (t) {
    t.plan(13);
    var port = Math.floor(Math.random() * 5e4 + 1e4);
    var server = seaport.createServer();
    
    var gotPort;
    server.once('register', function (alloc) {
        t.equal(gotPort, alloc.port);
        t.equal(alloc.beep, 'boop');
        t.equal(alloc.host, '127.1.2.3');
        
        server.once('register', function (alloc) {
            t.equal(alloc.port, gotPort);
            t.equal(alloc.foo, 'bar');
            t.ok(alloc.beep === undefined);
            t.equal(alloc.host, '127.0.0.1');
            
            ports.close();
            server.close();
            t.end();
        });
        
        var ps = ports.query('http');
        t.equal(ps.length, 1);
        t.equal(ps[0].host, '127.1.2.3');
        t.equal(ps[0].port, gotPort);
        t.equal(ps[0].beep, 'boop');
        ports.close();
    });
    
    server.once('free', function (alloc) {
        t.equal(alloc.beep, 'boop');
        ports = seaport.connect('localhost', port);
        ports.register('http', { port : gotPort, foo : 'bar' });
    });
    
    server.listen(port);
    
    var ports = seaport.connect('localhost', port);
    var p = ports.register({
        role : 'http',
        beep : 'boop',
        host : '127.1.2.3'
    });
    t.ok(p >= 10000 && p < 65536);
    gotPort = p;
});

var test = require('tap').test;
var seaport = require('../');

test('allocate with metadata', function (t) {
    t.plan(13);
    var port = Math.floor(Math.random() * 5e4 + 1e4);
    var server = seaport.createServer();
    
    var gotPort;
    server.on('allocate', function (alloc) {
        t.equal(gotPort, alloc.port);
        t.equal(alloc.beep, 'boop');
        t.equal(alloc.host, '127.0.0.1', 'ignore the supplied host');
        
        ports.query('http', function (ps) {
            t.equal(ps.length, 1);
            t.equal(ps[0].host, '127.0.0.1', 'ignore the supplied host');
            t.equal(ps[0].port, gotPort);
            t.equal(ps[0].beep, 'boop');
            ports.close();
        });
    });
    
    server.on('free', function (alloc) {
        t.equal(alloc.beep, 'boop');
        ports = seaport.connect('localhost', port);
        ports.assume('http', { port : gotPort, foo : 'bar' });
    });
    
    server.on('assume', function (alloc) {
        t.equal(alloc.port, gotPort);
        t.equal(alloc.foo, 'bar');
        t.ok(alloc.beep === undefined);
        t.equal(alloc.host, '127.0.0.1');
        
        ports.close();
        server.close();
        t.end();
        setTimeout(function () {
            process.exit(); // whatever
        }, 100);
    });
    
    server.listen(port);
    
    var ports = seaport.connect('localhost', port);
    ports.allocate(
        { role : 'http', beep : 'boop', host : '127.1.2.3' },
        function (p) {
            t.ok(p >= 10000 && p < 65536);
            gotPort = p;
        }
    );
});

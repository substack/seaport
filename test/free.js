var test = require('tap').test;
var seaport = require('../');

test('free', function (t) {
    t.plan(7);
    var port = Math.floor(Math.random() * 5e4 + 1e4);
    var server = seaport.createServer();
    server.listen(port);
    
    var ports = seaport.connect('localhost', port);
    
    var p = ports.register('http');
    t.ok(p >= 10000 && p < 65536);
    
    setTimeout(function () {
        // give time for the 'host' event to fire
        
        server.on('free', function (rec) {
            t.equal(rec.port, ps[0].port);
            t.equal(rec.host, ps[0].host);
            t.equal(rec.id, ps[0].id);
            ports.close();
        });
        
        var ps = ports.query('http');
        t.equal(ps.length, 1);
        t.equal(ps[0].host, '127.0.0.1');
        t.equal(ps[0].port, p);
        
        ports.free(ps[0]);
    }, 100);
    
    t.on('end', function () {
        server.close();
    });
});

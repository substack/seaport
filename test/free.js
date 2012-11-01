var test = require('tap').test;
var seaport = require('../');

test('free', function (t) {
    t.plan(5);
    var port = Math.floor(Math.random() * 5e4 + 1e4);
    var server = seaport.createServer();
    server.listen(port);
    
    var ports = seaport.connect('localhost', port);
    server.on('free', function (rec) {
        t.same(rec, ps[0]);
        ports.close();
    });
    
    var p = ports.register('http');
    t.ok(p >= 10000 && p < 65536);
    
    var ps = ports.query('http');
    t.equal(ps.length, 1);
    t.equal(ps[0].host, '127.0.0.1');
    t.equal(ps[0].port, p);
    
    ports.free(ps[0]);
    
    t.on('end', function () {
        server.close();
    });
});

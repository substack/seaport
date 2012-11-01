var seaport = require('../');
var test = require('tap').test;

test('secret', function (t) {
    t.plan(4);
    var serverPort = Math.floor(Math.random() * 5e4 + 1e4);
    var server = seaport.createServer({ secret : 'o_O' });
    server.listen(serverPort);
    
    var ports = [
        seaport.connect(serverPort, { secret : 'o_O' }),
        seaport.connect(serverPort, { secret : 'o_O' }),
    ];
    
    var t0 = Date.now();
    ports[0].get('woo', function (ps) {
        t.ok(Date.now() - t0 >= 100);
        t.equal(ps.length, 1);
        t.equal(ps[0].host, '127.0.0.1');
        t.equal(ps[0].port, gotPort);
        t.end();
    });
    
    var gotPort;
    setTimeout(function () {
        ports[1].service('woo', function (port, ready) {
            gotPort = port;
            setTimeout(ready, 50);
        });
    }, 50);
    
    t.on('end', function () {
        server.close();
        ports[0].close();
        ports[1].close();
    });
});

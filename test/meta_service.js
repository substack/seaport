var seaport = require('../');
var test = require('tap').test;

test('meta params in a service', function (t) {
    t.plan(4);
    var serverPort = Math.floor(Math.random() * 5e4 + 1e4);
    var server = seaport.createServer();
    server.listen(serverPort);
    
    var ports = [
        seaport.connect(serverPort),
        seaport.connect(serverPort),
    ];
    
    ports[0].get('woo', function (ps) {
        t.equal(ps.length, 1);
        t.equal(ps[0].host, '127.0.0.1');
        t.equal(ps[0].port, gotPort);
        t.equal(ps[0].beep, 'boop');
    });
    
    var gotPort;
    setTimeout(function () {
        gotPort = ports[1].register('woo', { beep : 'boop' });
    }, 50);
    
    t.on('end', function () {
        server.close();
        ports[0].close();
        ports[1].close();
    });
});

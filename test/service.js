var seaport = require('../');
var test = require('tap').test;

test('service', function (t) {
    t.plan(3);
    var serverPort = Math.floor(Math.random() * 5e4 + 1e4);
    var server = seaport.createServer();
    server.listen(serverPort);
    
    var ports = [
        seaport.connect(serverPort),
        seaport.connect('localhost:' + serverPort),
    ];
    
    ports[0].get('woo', function (ps) {
        t.equal(ps.length, 1);
        t.equal(ps[0].host, '127.0.0.1');
        t.equal(ps[0].port, gotPort);
    });
    
    var gotPort;
    setTimeout(function () {
        gotPort = ports[1].register('woo');
    }, 2000);
    
    t.on('end', function () {
        server.close();
        ports[0].close();
        ports[1].close();
    });
});

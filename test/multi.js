var seaport = require('../');
var test = require('tap').test;
var net = require('net');

var destroyer = require('destroyer');

test('multi-availability', function (t) {
    t.plan(5);
    
    var server0 = seaport.createServer();
    var server1 = seaport.createServer();
    
    var destroy0 = destroyer(server0);
    var destroy1 = destroyer(server1);
    
    server0.listen(0);
    server1.listen(0);
    
    (function () {
        var s = server1.createStream();
        server1.register({
            role : 'seaport',
            port : server1.address().port
        });
        s.pipe(net.connect(server0.address().port)).pipe(s);
    })();
    
    var ports = seaport.connect(server0.address().port);
    var wport = ports.register('woo');
    
    setTimeout(function () {
        t.equal(ports.query('woo')[0].port, wport);
        t.equal(server0.query('woo')[0].port, wport);
        t.equal(server1.query('woo')[0].port, wport);
        
        destroy0();
    }, 200);
    
    setTimeout(function () {
        var mport = ports.register('moo');
        setTimeout(function () {
            t.equal(ports.query('moo')[0].port, mport);
            t.equal(server1.query('moo')[0].port, mport);
        }, 2000);
    }, 300);
    
    t.on('end', function () {
        destroy1();
        ports.close();
    });
});

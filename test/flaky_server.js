var seaport = require('../');
var test = require('tap').test;

var destroyer = require('destroyer');

test('flaky-server', function (t) {
    t.plan(9);
    var opts = { heartbeatInterval: 200 };
    var server0 = seaport.createServer(opts);
    var server1 = seaport.createServer(opts);
    
    var destroy0 = destroyer(server0);
    var destroy1 = destroyer(server1);
    
    server0.listen(0);
    var port = server0.address().port;
    
    
    var ports0 = seaport.connect(port, opts);
    var ports1  = seaport.connect(port, opts);

    var wport = ports0.register('woo');

    var mport = ports1.register('moo');
    
    setTimeout(function () {
        t.equal(ports0.query('woo')[0].port, wport);
        t.equal(server0.query('woo')[0].port, wport);
        t.equal(ports0.query('moo')[0].port, mport);

        // 1st kill the seaport server
        destroy0();
    }, 200);
    
    setTimeout(function () {
        t.equal(ports0.query('woo')[0].port, wport);

        // Then kill ports1 with the moo registration
        ports1.close();

        // ports0 should still know about moo while still disconnected from
        // a seaport server
        t.equal(ports0.query('moo').length, 1);

        setTimeout(function () {
            // start a new seaport server on the same port as previous
            server1.listen(port);

            setTimeout(function () {
                // server and client should know of woo, but not moo
                t.equal(ports0.query('woo').length, 1);
                t.equal(server1.query('woo').length, 1);
                t.equal(ports0.query('moo').length, 0);
                t.equal(server1.query('moo').length, 0);
            }, 2000);
        }, 500);
    }, 300);
    
    t.on('end', function () {
        destroy1();
        ports0.close();
    });
});

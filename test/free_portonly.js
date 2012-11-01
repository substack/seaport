var test = require('tap').test;
var seaport = require('../');

test('free', function (t) {
    t.plan(5);
    var port = Math.floor(Math.random() * 5e4 + 1e4);
    var server = seaport.createServer();
    server.listen(port);

    var ports = seaport.connect('localhost', port);
    var gotPort, gotRec;
    server.on('free', function (rec) {
        t.same(rec, gotRec);
        ports.close();
    });

    ports.register('http', function (p) {
        t.ok(p >= 10000 && p < 65536);
        gotPort = p;

        process.nextTick(function () {
            var ps = ports.query('http');
            t.equal(ps.length, 1);
            t.equal(ps[0].host, '127.0.0.1');
            t.equal(ps[0].port, gotPort);

            gotRec = ps[0];
            ports.free(ps[0].port);
        });
    });

    t.on('end', function () {
        server.close();
    });
});

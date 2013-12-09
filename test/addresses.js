var test = require('tap').test;
var seaport = require('../');

test('addresses', function (t) {
    t.plan(8);

    var port = Math.floor(Math.random() * 5e4 + 1e4);
    var s1 = seaport.createServer();
    var s2 = seaport.createServer();
    var c = seaport.connect(port);

    t.equal(s1.addresses.asArray().length, 0);
    t.equal(s2.addresses.asArray().length, 0);
    t.equal(c.addresses.asArray().length, 0);

    s1.listen(port);

    var sockets = [];
    s1.on('connection', function (s) {
        sockets.push(s);
    });

    function first() {
        setTimeout(function () {
            t.equal(s1.addresses.asArray().length, 1);
            t.equal(s2.addresses.asArray().length, 0);
            t.equal(c.addresses.asArray().length, 1);

            s1.close();
            sockets.forEach(function (socket) {
                socket.end();
            });
            sockets.length = 0;

            s2.listen(port);
        }, 100);
        c.once('synced', second);
    }

    function second() {
        setTimeout(function () {
            t.equal(s2.addresses.asArray().length, 1);
            t.equal(c.addresses.asArray().length, 1);

            t.end();
        }, 100);
    }

    c.once('synced', first);

    t.on('end', function () {
        s2.close();
        c.close();
    });
});

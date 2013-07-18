var test = require('tap').test;
var seaport = require('../');

var fs = require('fs');
var keys = [
    {
        private : fs.readFileSync(__dirname + '/keys/beep'),
        public : fs.readFileSync(__dirname + '/keys/beep.pem'),
    },
    {
        private : fs.readFileSync(__dirname + '/keys/boop'),
        public : fs.readFileSync(__dirname + '/keys/boop.pem'),
    },
];

test('disallow authorized hosts with no key', function (t) {
    t.plan(2);

    var server = seaport.createServer({
        authorized : keys.map(function (k) { return k.public }),
        public : keys[0].public,
        private : keys[0].private
    });
    server.listen(0);

    server.once('register', function (service) {
        t.fail('registered when I should have been rejected');
        t.end();
    });

    server.once('reject', function (from, msg) {
        t.equal(msg.type, 'service');
        t.equal(msg._node, ports.doc.id);
        t.end();
    });

    var ports = seaport.connect(server.address().port);
    var port = ports.register('http');

    t.on('end', function () {
        server.close();
        ports.close();
    });
});
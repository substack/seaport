var test = require('tap').test;
var seaport = require('../');

var crypto = require('crypto');
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

test('reject unauthorized hosts', function (t) {
    t.plan(2);
    
    var server = seaport.createServer({
        authorized : [ keys[0] ],
        public : keys[0].public,
        private : keys[0].private,
    });
    server.listen(0);
    
    server.on('register', function (service) {
        t.fail('registered when it should have been rejected');
    });
    
    var ports = seaport.connect(server.address().port, keys[1]);
    ports.once('reject', function (from, msg) {
        t.equal(msg.type, 'address');
        t.equal(msg.node, ports.doc.id);
    });
    
    var port = ports.register('http');
    
    t.on('end', function () {
        server.close();
        ports.close();
    });
});

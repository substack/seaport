var test = require('tap').test;
var seaport = require('../');

var crypto = require('crypto');

function makePair () {
    // never use a value this low in real code
    // 256 just makes the test run faster
    var d = crypto.createDiffieHellman(256);
    d.generateKeys();
    return {
        public : {
            algorithm : 'SHA1',
            data : d.getPublicKey('base64'),
            encoding : 'base64'
        },
        private : {
            algorithm : 'RSA-SHA1',
            data : d.getPrivateKey('base64'),
            encoding : 'base64'
        }
    };
}

var keys = [ makePair(), makePair() ];

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

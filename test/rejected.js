var test = require('tap').test;
var seaport = require('../');

var crypto = require('crypto');

var keys = [
    (function () {
        // never use a value this low in real code
        // 256 just makes the test run faster
        var d = crypto.createDiffieHellman(256);
        d.generateKeys();
        return {
            public : d.getPublicKey('base64'),
            private : d.getPrivateKey('base64')
        };
    })()
];

test('reject unauthorized hosts', function (t) {
    t.plan(1);
    
    var server = seaport.createServer({ authorized : keys });
    server.listen(0);
    
    server.on('register', function (service) {
        t.fail('registered when it should have been rejected');
    });
    
    var ports = seaport.connect(server.address().port);
    ports.on('reject', function (rejected) {
        t.equal(port, rejected);
    });
    
    var port = ports.register('http');
    
    t.on('end', function () {
        server.close();
        ports.close();
    });
});

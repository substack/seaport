var test = require('tap').test;
var seaport = require('../');

var crypto = require('crypto');

var keys = {};

test('reject unauthorized hosts', function (t) {
    t.plan(1);
    
    var server = seaport.createServer({
        authorized : [ keys.public ]
    });
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

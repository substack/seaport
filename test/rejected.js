var test = require('tap').test;
var seaport = require('../');

var crypto = require('crypto');
var fs = require('fs');
var keys = [
    {
        private : fs.readFileSync(__dirname + '/keys/beep', 'utf8'),
        public : fs.readFileSync(__dirname + '/keys/beep.pem', 'utf8'),
    },
    {
        private : fs.readFileSync(__dirname + '/keys/boop', 'utf8'),
        public : fs.readFileSync(__dirname + '/keys/boop.pem', 'utf8'),
    },
];

test('reject unauthorized hosts', function (t) {
    t.plan(1);
    
    var server = seaport.createServer({
        authorized : [ keys[0].public ],
        public : keys[0].public,
        private : keys[0].private,
    });
    server.listen(0);
    
    server.on('register', function (service) {
        t.fail('registered when it should have been rejected');
    });
    
    var ports = seaport.connect(server.address().port, keys[1]);
    server.once('reject', function (id) {
        t.ok(id);
    });
    
    var port = ports.register('http');
    
    t.on('end', function () {
        server.close();
        ports.close();
    });
});

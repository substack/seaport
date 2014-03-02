var test = require('tap').test;
var seaport = require('../');

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

test('allow authorized hosts', function (t) {
    t.plan(2);
    
    var server = seaport.createServer({
        authorized : keys.map(function (k) { return k.public }),
        public : keys[0].public,
        private : keys[0].private
    });
    server.listen(0);
    
    server.once('register', function (service) {
        t.equal(service.port, port);
        t.equal(service.host, '127.0.0.1');
    });
    
    var ports = seaport.connect(server.address().port, keys[1]);
    server.once('reject', function (from, msg) {
        t.fail('message from ' + from + ' rejected');
        t.end();
    });
    
    var port = ports.register('http');
    
    t.on('end', function () {
        server.close();
        ports.close();
    });
});

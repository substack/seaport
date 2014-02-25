var net = require('net');
var seaport = require('../../lib/seaport.js');

var ports = seaport();
var server = net.createServer(function (stream) {
    return stream.pipe(ports.createStream()).pipe(stream);
});
server.listen(5001);

var bouncy = require('bouncy');
bouncy(function (req, res, bounce) {
    var domains = (req.headers.host || '').split('.');
    var service = 'http@' + ({
        unstable : '0.1.x',
        stable : '0.0.x'
    }[domains[0]] || '0.0.x');
    
    var ps = ports.query(service);
    
    if (ps.length === 0) {
        res.end('service not available\n');
    }
    else {
        bounce(ps[Math.floor(Math.random() * ps.length)]);
    }
}).listen(5000);

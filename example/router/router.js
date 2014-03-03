var net = require('net');
var seaport = require('../../');
var ports = seaport.createServer();
ports.listen(5001);

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

setInterval(function () {
    console.log(ports.query());
}, 1000);

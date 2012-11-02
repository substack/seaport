var seaport = require('../../');
var server = seaport.createServer()
server.listen(5001);

var bouncy = require('bouncy');
bouncy(function (req, bounce) {
    var domains = (req.headers.host || '').split('.');
    var service = 'http@' + ({
        unstable : '0.1.x',
        stable : '0.0.x'
    }[domains[0]] || '0.0.x');
    
    var ps = server.query(service);
    
    if (ps.length === 0) {
        var res = bounce.respond();
        res.end('service not available\n');
    }
    else {
        bounce(ps[Math.floor(Math.random() * ps.length)]);
    }
}).listen(5000);

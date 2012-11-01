var net = require('net');
var seaport = require('./lib/seaport');

exports = module.exports = seaport;

exports.connect = function (port, host) {
    var args = arguments;
    if (typeof port === 'string' && typeof host === 'number') {
        args[0] = host;
        args[1] = port;
    }
    if (typeof port === 'string' && /:/.test(port)) {
        host = port.split(':')[0];
        port = port.split(':')[1];
    }
    
    var s = seaport();
    var closed = false;
    
    var c;
    s.close = function () {
        closed = true;
        c.end();
    };
    
    (function reconnect () {
        c = net.connect.apply(null, args);
        c.pipe(s.createStream()).pipe(c);
        c.on('error', function (err) {
            if (closed) return;
            setTimeout(reconnect, 1000);
        });
        
        c.on('close', function () {
            if (closed) return;
            setTimeout(reconnect, 1000);
        });
    })();
    
    return s;
};

exports.createServer = function () {
    var s = seaport();
    s.server = net.createServer(function (c) {
        c.pipe(s.createStream(c.address().address)).pipe(c);
    });
    s.listen = s.server.listen.bind(s.server);
    s.close = s.server.close.bind(s.server);
    return s;
};

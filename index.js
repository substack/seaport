var net = require('net');
var seaport = require('./lib/seaport');

exports = module.exports = function () {
    return seaport.apply(this, arguments);
};

exports.connect = function (port, host) {
    var args = [].slice.call(arguments);
    var opts = {};
    for (var i = 0; i < args.length; i++) {
        if (typeof args[i] === 'object') {
            opts = args[i];
            args.splice(i, 1);
            break;
        }
    }
    
    if (typeof port === 'string' && typeof host === 'number') {
        args[0] = host;
        args[1] = port;
    }
    if (typeof port === 'string' && /:\d+$/.test(port)) {
        host = port.split(':')[0];
        port = port.split(':')[1];
    }
    if (typeof port === 'string' && !/^\d+$/.test(port)) {
        port = Number(port);
    }
    
    var s = seaport(opts);
    var c = (function reconnect () {
        if (s.closed) return;
        var c = net.connect.apply(null, args);
        var active = true;
        
        c.on('end', onend);
        c.on('error', onend);
        c.on('close', onend);
        
        c.pipe(s.createStream()).pipe(c);
        
        return c;
        
        function onend () {
            if (s.closed) return;
            if (!active) return;
            active = false;
            setTimeout(reconnect, 1000);
        }
    })();
    
    s.on('close', function () {
        if (c) c.end();
    });
    
    return s;
};

exports.createServer = function (opts) {
    var s = seaport(opts);
    
    s.server = net.createServer(function (c) {
        c.pipe(s.createStream(c.address().address)).pipe(c);
    });
    s.listen = s.server.listen.bind(s.server);
    s.on('close', function () {
        s.server.close();
    });
    return s;
};

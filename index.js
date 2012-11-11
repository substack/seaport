var net = require('net');
var seaport = require('./lib/seaport');
var version = require('./package.json').version;

exports = module.exports = function () {
    return seaport.apply(this, arguments);
};

Object.keys(seaport).forEach(function (key) {
    exports[key] = seaport[key];
});

exports.connect = function () {
    var args = [].slice.call(arguments);
    var opts = {};
    for (var i = 0; i < args.length; i++) {
        if (typeof args[i] === 'object') {
            opts = args[i];
            args.splice(i, 1);
            break;
        }
    }
    var port = args[0];
    var host = args[1];
    
    if (typeof port === 'string' && typeof host === 'number') {
        host = args[0];
        port = args[1];
    }
    if (typeof port === 'string' && /:\d+$/.test(port)) {
        host = port.split(':')[0];
        port = port.split(':')[1];
    }
    if (typeof port === 'string' && /^\d+$/.test(port)) {
        port = Number(port);
    }
    
    var s = seaport(opts);
    var conIx = 0;
    
    var c = (function reconnect () {
        if (s.closed) return;
        
        var hubs = [ { port : port, host : host } ].concat(s.query('seaport'));
        var c = net.connect.call(null, hubs[conIx].port, hubs[conIx].host);
        conIx = (conIx + 1) % hubs.length;
        
        var active = true;
        
        c.on('connect', s.emit.bind(s, 'connect'));
        
        c.on('end', onend);
        c.on('error', onend);
        c.on('close', onend);
        
        c.pipe(s.createStream()).pipe(c);
        
        return c;
        
        function onend () {
            if (s.closed) return;
            if (!active) return;
            active = false;
            s.emit('disconnect');
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
        var stream = s.createStream(c.address().address);
        c.on('error', stream.emit.bind(stream, 'error'));
        c.pipe(stream).pipe(c);
    });
    s.listen = s.server.listen.bind(s.server);
    s.address = s.server.address.bind(s.server);
    
    s.peer = function () {
        if (!s.address()) {
            var args = arguments;
            s.once('listening', function () {
                s.peer.apply(s, args);
            });
            return;
        }
        
        var stream = s.createStream();
        var c = exports.connect.apply(this, arguments);
        s.on('close', c.close.bind(c));
        stream.pipe(c.createStream()).pipe(stream);
        
        c.register({
            role : 'seaport@' + version,
            port : s.address().port
        });
    };
    
    s.on('close', function () {
        s.server.close();
    });
    
    s.server.on('listening', s.emit.bind(s, 'listening'));
    s.server.on('connection', s.emit.bind(s, 'connection'));
    
    return s;
};

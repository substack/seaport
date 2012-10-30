var net = require('net');
var seaport = require('./lib/seaport');

exports = module.exports = seaport;

exports.connect = function (port, host) {
    if (typeof port === 'string' && typeof host === 'number') {
        arguments[0] = host;
        arguments[1] = port;
    }
    
    var s = seaport();
    var c = net.connect.apply(null, arguments);
    c.pipe(s.createStream()).pipe(c);
    return s;
};

exports.createServer = function () {
    var s = seaport();
    s.server = net.createServer(function (c) {
        c.pipe(s.createStream(c.address().address)).pipe(c);
    });
    s.listen = s.server.listen.bind(s.server);
    return s;
};

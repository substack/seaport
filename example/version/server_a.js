var seaport = require('../../');
var ports = seaport.connect('localhost', 6000);
var http = require('http');

var server = http.createServer(function (req, res) {
    res.end('beep boop v0.5.2\r\n');
});

server.listen(ports.register('http@0.5.2'));

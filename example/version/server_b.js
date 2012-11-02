var seaport = require('../../');
var ports = seaport.connect('localhost', 6000);
var http = require('http');

var server = http.createServer(function (req, res) {
    res.end('beep boop v0.4.3\r\n');
});

server.listen(ports.service('http@0.4.3'));

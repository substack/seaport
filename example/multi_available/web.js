var seaport = require('../../');
var ports = seaport.connect(9090);
var http = require('http');

var server = http.createServer(function (req, res) {
    res.end('beep boop\r\n');
});

server.listen(ports.register('web@1.2.3'));

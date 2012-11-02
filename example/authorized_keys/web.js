var seaport = require('../../');
var ports = seaport.connect(9090, require('./keys/web.json'));

var http = require('http');
var server = http.createServer(function (req, res) {
    res.end('beep boop\n');
});
server.listen(ports.register('web@1.2.3'));

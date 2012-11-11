var seaport = require('../../');
var http = require('http');

var client = seaport.connect(8080);
var port = client.register("client@v" + Math.random());
process.stdin.resume();

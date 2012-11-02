var fs = require('fs');
var publicKeys = fs.readdirSync(__dirname + '/keys')
    .filter(function (x) { return /\.json$/.test(x) })
    .map(function (x) { return require('./keys/' + x).public })
;
var seaport = require('../../');

var opts = require('./keys/hub.json');
opts.authorized = publicKeys;

var ports = seaport.createServer(opts);
ports.listen(9090);

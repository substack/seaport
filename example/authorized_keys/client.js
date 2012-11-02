var seaport = require('../../');
var ports = seaport.connect(9090);
var request = require('request');

ports.get('web@1.2.x', function (ps) {
    var u = 'http://' + ps[0].host + ':' + ps[0].port;
    var r = request(u);
    
    r.pipe(process.stdout);
    r.on('end', ports.close.bind(ports));
});

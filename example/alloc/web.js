var seaport = require('../../');
var ports = seaport.connect('localhost', 9090);

ports.allocate('web', function (port) {
    console.log('allocated ' + port);
});

var seaport = require('../../');
var server = seaport.createServer();

server.on('allocate', function (alloc) {
    console.log('--- allocated ---');
    console.dir(alloc);
});

server.on('free', function (free) {
    console.log('--- freed ---');
    console.dir(free);
});

server.listen(9090);

setInterval(function () {
    console.dir(server.query());
}, 1000);

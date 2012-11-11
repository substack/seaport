var seaport = require('../../');
var spawn = require('child_process').spawn;


// create a server
var server = seaport.createServer();
server.listen(8080);
server.on('register', function () { 
    console.log("service registered, " + server.query().length + " services total") 
});
server.on('free', function () { 
    console.log("service freed, " + server.query().length + " services total") 
});


// create 2 client processes
var args = [ __dirname + '/epipe_error_client' ];
var child1 = spawn('node', args);
var child2 = spawn('node', args);

setTimeout(function () {
    console.log("------ wait for it ------");
}, 500);

setTimeout(function () {
    child1.kill();
    child2.kill();
    server.close();
}, 1000);


//  show the exception and demonstrate that the corresponding services are still registered
process.on('uncaughtException', function (err) {
    console.log(err, '- note that clients with EPIPE errors do not get freed -', server.query());
});

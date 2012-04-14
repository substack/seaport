var seaport = require('../');
var test = require('tap').test;

test("subscribing to server events", function (t) {
    var serverPort = Math.floor(Math.random() * 5e4 + 1e4),
        server = seaport.createServer(),
        client = seaport.connect("localhost:" + serverPort),
        allocatedPort = 1234;

    server.listen(serverPort);
    t.plan(3);

    client.on("allocate", function(data) { 
        t.equal(data.port, allocatedPort, "event is fired with allocated port");
    });

    client.on("assume", function(data) {
        t.equal(data.port, allocatedPort, "event is fired with assumed port");
    });

    client.on("free", function(data) {
        t.equal(data.port, allocatedPort, "event is fired with freed port");
    });

    // Seems like it would be better to wrap this code in `client.up()`,
    // but I couldn't get it to work, the code would never fire.
    setTimeout(function(remote) {
        server.emit("allocate", {port: allocatedPort});
        server.emit("assume", {port: allocatedPort});
        server.emit("free", {port: allocatedPort});
    }, 200);

    t.on("end", function() {
        server.close();
        client.close();
        t.ok(true, "closed server");
    });
});

var seaport = require('../');
var test = require('tap').test;

test('resubscribe if connection dies', function(t) {
    var serverPort = Math.floor(Math.random() * 5e4 + 1e4);
    var server = seaport.createServer();
    var client = seaport.connect('localhost:' + serverPort, { reconnect: 10 });
    
    t.plan(6);
    
    var eventNames = ['allocate', 'assume', 'free'];
    
    eventNames.forEach(function(eventName) {
        client.subscribe(eventName, function() {
            t.ok(true, eventName + ' emitted');
        });
    });
    
    function emit() {
        eventNames.forEach(function(eventName) {
            server.emit(eventName, {});
        });
    }
    
    server.listen(serverPort);
    
    // Wait for client to connect
    setTimeout(emit, 200)
    
    // Wait for first tests to finish
    setTimeout(function() {
        client.up.conn.stream.end();
    }, 400);
    
    // Run second test
    setTimeout(emit, 1600);
    
    t.on('end', function() {
        server.close();
        client.close();
        t.ok(true, 'closed server');
    });
});

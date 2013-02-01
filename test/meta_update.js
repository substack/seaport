var seaport = require('../');
var test = require('tap').test;

test('update meta params at runtime', function (t) {
    t.plan(7);
    var server = seaport.createServer();
    server.listen(0);
    
    var ports = [
        seaport.connect(server.address().port),
        seaport.connect(server.address().port),
    ];
    
    t.on('end', function () {
        server.close();
        ports[0].close();
        ports[1].close();
    });
    
    var port = ports[1].register('woo', { beep : 'boop' });
    ports[0].get('woo', function (ps) {
        t.equal(ps.length, 1);
        t.equal(ps[0].host, '127.0.0.1');
        t.equal(ps[0].port, port);
        t.equal(ps[0].beep, 'boop');
        
        ps[0].beep = 'BOOP';
        ports[0].doc.set(ps[0].id, ps[0]);
        
        setTimeout(function () {
            t.equal(ports[1].query('woo').length, 1);
            t.equal(ports[1].query('woo')[0].beep, 'BOOP');
            t.equal(server.query('woo')[0].beep, 'BOOP');
        }, 100);
    });
});

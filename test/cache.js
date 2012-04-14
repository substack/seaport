var test = require('tap').test;
var seaport = require('../');

test('cache', function (t) {
    t.plan(9);
    var port = Math.floor(Math.random() * 5e4 + 1e4);
    var server = seaport.createServer();
    
    var gotPort;
    var waitingForClear = false;
    server.on('allocate', function (alloc) {
        t.equal(gotPort, alloc.port);
        t.deepEqual(ports.cache._cache, {}, 'cache should be empty');

        ports.cache.query('http', function (psUncached) {
            ports.cache.query('http', function (psCached) {
                t.deepEqual(psCached, psUncached, '2nd query should be from cache');
                t.deepEqual(ports.cache.get('http'), psCached, 'value out of cache should be same');

                waitingForClear = true;
                ports.free(psCached[0]);
            });
        });
    });

    server.on('assume', function (alloc) {
        t.equal(alloc.port, gotPort);

        ports.cache.query('http', function (psUncached) {
            ports.cache.query('http', function (psCached) {
                t.deepEqual(psCached, psUncached, 'for assume, 2nd query should be from cache');
                t.deepEqual(ports.cache.get('http'), psCached, 'for assume, value out of cache should be same');

                ports.close();
                server.close();
                t.end();
                setTimeout(function () {
                    process.exit(); // whatever
                }, 100);
            });
        });

    });
    
    server.listen(port);
    
    var ports = seaport.connect('localhost', port);

    ports.on('cache.clear', function () {
        if(waitingForClear) {
            t.deepEqual(ports.cache._cache, {}, 'cache should be empty again after free');
            ports.close();
            ports = seaport.connect('localhost', port);
            ports.assume('http', gotPort);            
        }
    });    
    
    ports.allocate('http', function (p) {
        t.ok(p >= 10000 && p < 65536);
        gotPort = p;
    });
});

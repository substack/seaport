var test = require('tap').test
var seaport = require('../')
var net = require('net')
var async = require('async')
var macgyver = require('macgyver')
var fs = require('fs')

test('peer regs and frees propogate with correct events', function (t) {
    var mac = macgyver()
    var s1 = seaport.createServer()
    var s2 = seaport.createServer()

    s1.listen(0)
    s2.listen(0)

    var c1 = seaport.connect(s1.address().port)
    var c2 = seaport.connect(s2.address().port)

    s1.peer(s2.address().port)
    // connecting from both sides shouldn't break anything
    s2.peer(s1.address().port)

    var s1reg = mac(fn)
    var s2reg = mac(fn)

    var s1free = mac(fn)
    var s2free = mac(fn)
    var c1free = mac(fn)
    var c2free = mac(fn)

    s1reg.times(3)
    s2reg.times(3)

    s1free.isCalled(3)
    s2free.isCalled(3)
    c1free.isCalled(3)
    c2free.isCalled(3)

    s1.on('register', s1reg)
    s2.on('register', s2reg)

    s1.on('free', s1free)
    s2.on('free', s2free)
    c1.on('free', c1free)
    c2.on('free', c2free)

    function fn () { }

    t.equal(c1.query().length, 0, 'initially empty')
    t.equal(c2.query().length, 0, 'initially empty')

    var web1 = net.createServer(function (stream) { stream.end('foo') })

    web1.listen(c1.register('web@0.0.0'), function () {
        setTimeout(function () {
            t.equal(c1.query('web').length, 1, 'c1 web')
            t.equal(c2.query('web').length, 1, 'c2 web')
            t.equal(s2.query('web').length, 1, 's1 web')
            t.equal(s2.query('web').length, 1, 's2 web')

            service = c2.query('web')[0]
            c1.free(service)
            setTimeout(function () {
                t.equal(c1.query('web').length, 0, 'c1 free')
                t.equal(c2.query('web').length, 0, 'c2 free')
                t.equal(s2.query('web').length, 0, 's1 free')
                t.equal(s2.query('web').length, 0, 's2 free')

                async.each([s1,s2,c1,c2,web1], function (server, cb) {
                    server.on('close', cb)
                    server.close()
                }, function (err) {
                    if (err) throw err;
                    setTimeout(function () {
                        mac.validate()
                        t.end()
                    }, 200)
                })
            }, 200)
        }, 200)
    })
})

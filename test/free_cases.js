var test = require('tap').test
var seaport = require('../')
var net = require('net')
var fs = require('fs')

test('frees with no auth', function (t) {
    var server = seaport.createServer({heartbeatInterval: 500})
    server.listen(0)

    var ports = seaport.connect(server.address().port)

    t.equal(ports.query().length, 0, 'initially empty')

    var web = net.createServer(function (stream) {
        stream.end('hi')
    })

    web.listen(ports.register('web@0.0.1'), function () {
        t.equal(ports.query().length, 1, 'one register')

        web.close(function () {

            setTimeout(function () {
                t.equal(ports.query().length, 0, 'after close')
                t.end()
            }, 4000)
        })
    })

    t.on('end', function () {
        server.close()
        ports.close()
    })
})

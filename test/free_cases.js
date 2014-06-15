var test = require('tap').test
var seaport = require('../')
var net = require('net')
var fs = require('fs')
var spawn = require('child_process').spawn

test('frees with no auth', function (t) {
    var s1 = seaport.createServer({heartbeat: 50, timeout: 60})
    s1.listen(0)

    t.equal(s1.query().length, 0)

    var client = spawn('node', [__dirname+'/lib/_client.js', s1.address().port])

    var web = net.createServer(function (stream) {
        stream.end('hi')
    })

    s1.on('register', function (service) {
        t.equal(s1.query().length, 1)
        client.kill()
    })

    client.on('exit', function () {
        setTimeout(function () {
            t.equal(s1.query().length, 0)
            t.end()
        }, 200)
    })

    t.on('end', function () {
        s1.close()
    })
})

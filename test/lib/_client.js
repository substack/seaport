var seaport = require('../../')
var net = require('net')

var ports = seaport.connect(process.argv[2])

var server = net.createServer(function (stream) {
    stream.pipe(stream)
})

server.listen(ports.register('web@0.0.1'))

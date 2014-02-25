var split = require('split');
var through = require('through');
var combine = require('stream-combiner');
var inherits = require('inherits');
var EventEmitter = require('events').EventEmitter;
var Duplex = require('readable-stream').Duplex;
var indexOf = require('indexof');
var json = typeof JSON !== 'undefined' ? JSON : require('jsonify');
var objectKeys = require('object-keys');
var generateId = require('./id.js');

module.exports = Seaport;
inherits(Seaport, EventEmitter);

function Seaport () {
    if (!(this instanceof Seaport)) return new Seaport;
    this.endpoints = [];
    this.streams = [];
    this.services = {};
    this.known = {};
}

Seaport.prototype.createStream = function () {
    var self = this;
    var sp = split(json.parse);
    var p = new Protocol;
    this.endpoints.push(p);
    
    p.on('end', function () {
        var ix = indexOf(self.endpoints, p);
        self.endpoints.splice(ix, 1);
    });
    p.on('register', function (id, meta) {
        self.known[id] = meta;
    });
    p.on('unregister', function (id) {
        delete self.known[id];
    });
    
    this.emit('endpoint', p);
    var stream = combine(sp, p, unsplit());
    stream.helo = function (addr) {
        p.push([ 'helo', addr ]);
    };
    registerServices(this.services, p);
    return stream;
};

Seaport.prototype.register = function (meta) {
    var self = this;
    var id = generateId();
    if (typeof meta === 'string') {
        meta = { role: meta };
    }
    if (/@/.test(meta.role)) {
        meta.version = meta.role.split('@')[1];
        meta.role = meta.role.split('@')[0];
    }
    
    if (!meta.port) {
        meta.port = 10000 + Math.floor(Math.random() * 55000);
    }
    this.services[id] = meta;
    
    this.on('endpoint', function onendpoint (p) {
        registerServices(self.services, p);
    });
    for (var i = 0; i < this.endpoints.length; i++) {
        registerServices([ meta ], this.endpoints[i]);
    }
    
    return meta.port;
};

Seaport.prototype.query = function () {
    var keys = objectKeys(this.known);
    var rows = [];
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        rows.push(this.known[key]);
    }
    return rows;
};

inherits(Protocol, Duplex);
function Protocol () {
    Duplex.call(this, { objectMode: true });
}

Protocol.prototype._write = function (row, enc, next) {
    if (row[0] === 'register') {
        this.emit('register', row[1], row[2]);
    }
    next();
};

Protocol.prototype._read = function (size) {};

function unsplit () {
    return through(function (row) {
        this.queue(json.stringify(row) + '\n')
    });
}

function registerServices (services, p) {
    var keys = objectKeys(services);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        p.push([ 'register', key, services[key] ]);
    }
}

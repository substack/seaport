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
var semver = require('semver');

module.exports = Seaport;
inherits(Seaport, EventEmitter);

function Seaport () {
    if (!(this instanceof Seaport)) return new Seaport;
    this.endpoints = [];
    this.services = {};
    this.known = {};
}

Seaport.prototype.createStream = function (addr) {
    var self = this;
    var sp = split(json.parse);
    
    var p = new Protocol;
    this.endpoints.push(p);
    
    p.on('end', onend);
    p.on('register', function onregister (id, meta) {
        if (!meta.host) meta.host = helo;
        self.known[id] = meta;
        
        for (var i = 0; i < self.endpoints.length; i++) {
            var e = self.endpoints[i];
            if (e === p) continue;
            e.push([ 'register', id, meta ]);
        }
        self.emit('register', meta, id);
    });
    p.on('free', function (id) {
        var meta = self.known[id];
        delete self.known[id];
        self.emit('free', meta, id);
    });
    
    if (!addr && !self._host) {
        p.on('helo', function (addr) {
            self._host = addr;
            self.emit('address', addr);
        });
    }
    
    this.emit('endpoint', p);
    var stream = combine(sp, p, unsplit());
    stream.on('error', onend);
    
    if (addr) p.push([ 'helo', addr ]);
    
    registerServices(this.services, p);
    return stream;
    
    function onend () {
        var ix = indexOf(self.endpoints, p);
        self.endpoints.splice(ix, 1);
        var keys = objectKeys(p.known);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            delete self.known[key];
            self.emit('free', self.known[key]);
        }
    }
};

Seaport.prototype.register = function (meta, port) {
    var self = this;
    var id = generateId();
    meta = fixMeta(meta);
    
    if (!meta.port) {
        meta.port = port || 10000 + Math.floor(Math.random() * 55000);
    }
    this.services[id] = meta;
    
    if (!meta.host && this._host) {
        meta.host = this._host;
        register();
    }
    else if (!meta.host) {
        this.once('address', function (addr) {
            meta.host = addr;
            register();
        });
    }
    
    return meta.port;
    
    function register () {
        var mserv = {};
        mserv[id] = meta;
        for (var i = 0; i < self.endpoints.length; i++) {
            registerServices(mserv, self.endpoints[i]);
        }
    }
};

Seaport.prototype.close = function () {
    this.closed = true;
    for (var i = 0; i < this.endpoints.length; i++) {
        this.endpoints[i].end();
    }
    this.emit('close');
};

Seaport.prototype.query = function (meta) {
    meta = fixMeta(meta);
    var mkeys = objectKeys(meta);
    var skeys = objectKeys(this.services);
    var keys = objectKeys(this.known);
    
    var rows = [];
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var row = this.known[key];
        if (matches(row)) rows.push(row);
    }
    for (var i = 0; i < skeys.length; i++) {
        var key = skeys[i];
        var row = this.services[key];
        if (matches(row)) rows.push(row);
    }
    return rows;
    
    function matches (row) {
        for (var i = 0; i < mkeys.length; i++) {
            var mkey = mkeys[i];
            if (mkey === 'version') {
                if (!semver.satisfies(row.version, meta.version)) {
                    return false;
                }
            }
            else if (row[mkey] !== meta[mkey]) return false;
        }
        return true;
    }
};

inherits(Protocol, Duplex);
function Protocol () {
    Duplex.call(this, { objectMode: true });
    this.known = {};
}

Protocol.prototype._write = function (row, enc, next) {
    if (row[0] === 'register') {
        this.known[row[1]] = row[2];
        this.emit('register', row[1], row[2]);
    }
    else if (row[0] === 'free') {
        var meta = this.known[row[1]];
        delete this.known[row[1]];
        this.emit('free', row[1], meta);
    }
    else if (row[0] === 'helo') {
        this.emit('helo', row[1]);
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

function fixMeta (meta) {
    if (!meta) return {};
    if (typeof meta === 'string') {
        meta = { role: meta };
    }
    if (/@/.test(meta.role)) {
        meta.version = meta.role.split('@')[1];
        meta.role = meta.role.split('@')[0];
    }
    return meta;
}

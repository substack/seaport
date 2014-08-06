var inherits = require('inherits');
var EventEmitter = require('events').EventEmitter;
var indexOf = require('indexof');
var objectKeys = require('object-keys');
var semver = require('semver');
var defined = require('defined');
var secure = require('secure-peer');
var merge = require('merge');

var generateId = require('./id.js');
var Protocol = require('./protocol.js');

module.exports = Seaport;
inherits(Seaport, EventEmitter);

function Seaport (opts) {
    var self = this;
    if (!(this instanceof Seaport)) return new Seaport(opts);
    if (!opts) opts = {};
    this.endpoints = [];
    this.services = {};
    this.heartbeat = defined(opts.heartbeat, 15 * 1000);
    this.timeout = defined(opts.timeout, this.heartbeat * 3);
    this.known = {};
    this.doc = this; // for legacy .doc.set() syntax, deprecated
    
    if (opts.private) {
        var keys = { private: opts.private, public: opts.public };
        this.secure = secure(keys);
        if (opts.authorized) {
            this.authorized = opts.authorized.map(normalizeKey);
        }
    }
}

// each stream creates a new endpoint
Seaport.prototype.createStream = function (addr) {
    var self = this;
    var p = new Protocol({
        heartbeat: this.heartbeat,
        timeout: this.timeout,
    });
    this.endpoints.push(p);
    
    p.on('end', onend);
    p.on('register', function onregister (id, meta) {
        // prevents loops when peers connect from both sides
        if (self.known[id] && self.query(meta).length) return;

        if (!meta.host) meta.host = self._host;
        
        if (self.services[id]) {
            self.services[id] = meta;
        }
        else {
            self.known[id] = meta;
        }
        
        for (var i = 0; i < self.endpoints.length; i++) {
            var e = self.endpoints[i];
            if (e === p) continue;
            e.send([ 'register', id, meta ]);
        }
        self.emit('register', meta, id);
    });
    p.on('timeout', function () {
        onend();
        stream.emit('timeout');
    });
    p.on('free', function (id) {
        var obj = self.known[id] ? self.known : self.services;
        var meta = obj[id];
        if (!meta) return;

        for (var i = 0; i < self.endpoints.length; i++) {
            var e = self.endpoints[i];
            e.send(['free', id]);
        }

        delete obj[id];
        self.emit('free', meta, id);
    });
    p.on('synced', function () {
        stream.emit('synced');
        self.emit('synced', stream);
    });
    
    if (!addr && !self._host) {
        p.on('helo', function (addr) {
            self._host = addr;
            self.emit('address', addr);
        });
    }
    
    this.emit('endpoint', p);
    var stream;
    if (this.secure) {
        stream = this.secure(function (s) {
            s.pipe(p.createStream()).pipe(s);
        });
        stream.on('identify', function (id) {
            if (self._isAuthorized(id.key.public)) {
                id.accept();
                self.emit('accept', id);
            }
            else {
                id.reject();
                self.emit('reject', id);
            }
        });
    }
    else {
        stream = p.createStream();
    }
    stream.on('error', onend);
    stream.on('close', onend);
    p.once('close', function () {
        p.destroy();
        var keys = objectKeys(p.known);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var meta = self.known[key];
            if (!meta) continue;
            delete self.known[key];
            self.emit('free', meta, key);
        }
    });
    
    if (addr) p.send([ 'helo', addr ]);
    
    registerServices(merge(this.known, this.services), p);
    self.emit('stream', stream);
    self.emit('protocol', p);
    return stream;
    
    function onend () {
        if (p._ended) return;
        p._ended = true;
        p.destroy();
        
        var ix = indexOf(self.endpoints, p);
        self.endpoints.splice(ix, 1);
        var keys = objectKeys(p.known);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var meta = self.known[key];
            if (!meta) continue;

            delete self.known[key];
            
            for (var j = 0; j < self.endpoints.length; j++) {
                var e = self.endpoints[j];
                if (e === p) continue;
                e.send([ 'free', key ]);
            }
            
            self.emit('free', meta, key);
        }
    }
};

Seaport.prototype.register = function () {
    return this.registerMeta.apply(this, arguments).port;
};

Seaport.prototype.registerMeta = function (meta, port) {
    var self = this;
    meta = fixMeta(meta, port);
    
    if (!meta.port) {
        meta.port = 10000 + Math.floor(Math.random() * 55000);
    }
    var id = meta.id || generateId();
    meta.id = id;
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
    else register()
    
    return meta;
    
    function register () {
        var mserv = {};
        mserv[id] = meta;
        for (var i = 0; i < self.endpoints.length; i++) {
            registerServices(mserv, self.endpoints[i]);
        }
    }
};

Seaport.prototype.free = function (meta) {
    var id;
    if (typeof meta === 'number') {
        meta = { port: meta };
    }
    if (typeof meta === 'object') {
        var keys = objectKeys(this.services).concat(objectKeys(this.known));
        var mkeys = objectKeys(meta);
        for (var i = 0; i < keys.length; i++) {
            var s = this.services[keys[i]] || this.known[keys[i]];
            for (var j = 0; j < mkeys.length; j++) {
                if (meta[mkeys[j]] !== s[mkeys[j]]) break;
            }
            if (j === mkeys.length) {
                id = keys[i];
                meta = this.services[id];
                break;
            }
        }
        if (i === keys.length) return;
    }
    else {
        id = meta;
        meta = this.services[id] || this.known[id];
    }

    if (this.services[id]) {
        meta = this.services[id];
        delete this.services[id];
    } else if (this.known[id]) {
        meta = this.known[id];
        delete this.known[id];
    } else {
        return;
    }
    
    for (var i = 0; i < this.endpoints.length; i++) {
        var e = this.endpoints[i];
        e.send([ 'free', id ]);
    }
    this.emit('free', meta, id);
};

Seaport.prototype.close = function () {
    this.closed = true;
    for (var i = 0; i < this.endpoints.length; i++) {
        var e = this.endpoints[i];
        e.emit('close');
        e.end();
    }
    this.emit('close');
};

Seaport.prototype.get = function get (meta, cb) {
    var self = this;
    var ps = this.query(meta);
    if (ps.length > 0) return cb(ps);
    this.once('register', function () { self.get(meta, cb) });
};

Seaport.prototype.set = function (id, meta) {
    var records = this.services[id] ? this.services : this.known;
    if (!records[id]) return;
    
    records[id] = meta;
    if (this.services[id]) return;
    
    for (var i = 0; i < this.endpoints.length; i++) {
        var e = this.endpoints[i];
        e.send([ 'register', id, meta ]);
    }
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

Seaport.prototype._isAuthorized = function (id) {
    if (!this.authorized) return true;
    return indexOf(this.authorized, normalizeKey(id)) >= 0;
};

function registerServices (services, p) {
    var keys = objectKeys(services);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        p.send([ 'register', key, services[key] ]);
    }
    p.send([ 'synced' ]);
}

function fixMeta (meta, port) {
    if (!meta) return {};
    if (typeof meta === 'string') {
        if (typeof port === 'object') {
            port.role = meta;
            meta = port;
        }
        else meta = { role: meta };
    }
    if (typeof port === 'number') {
        meta.port = port;
    }
    if (/@/.test(meta.role)) {
        meta.version = meta.role.split('@')[1];
        meta.role = meta.role.split('@')[0];
    }
    return meta;
}

function normalizeKey (id) {
    return (typeof id === 'string' ? id : String(id))
        .replace(/^-----BEGIN \w+ \w+ KEY-----\s*/, '')
        .replace(/^-----END \w+ \w+ KEY-----\s*/, '')
        .replace(/\s+/g, '')
    ;
}

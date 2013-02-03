var inherits = require('inherits');
var EventEmitter = require('events').EventEmitter;
var crypto = require('crypto');

var through = require('through');
var semver = require('semver');

var crdt = require('crdt');
var createId = require('./id');

module.exports = Seaport;

function Seaport (opts) {
    var self = this;
    if (!(self instanceof Seaport)) return new Seaport(opts);
    if (!opts) opts = {};
    self._authorized = {};
    
    function lookupKey () {
        var spub = String(opts.public);
        var keys = Object.keys(self._authorized);
        for (var i = 0; i < keys.length; i++) {
            if (self._authorized[keys[i]] === spub) {
                return keys[i];
            }
        }
        keys = Object.keys(self.authorized.rows);
        for (var i = 0; i < keys.length; i++) {
            if (self.authorized.rows[keys[i]].state.key === spub) {
                return keys[i];
            }
        }
    }
    
    self.doc = !opts.private || !opts.public ? new crdt.Doc : new(crdt.Doc)({
        id : createId(),
        sign : function (update) {
            if (opts.private) {
                var algo = /^-----BEGIN (\S+)/.exec(String(opts.private))[1];
                var s = crypto.createSign(algo + '-SHA256');
                
                s.update(JSON.stringify(update));
                var x = s.sign(opts.private, 'base64');
                return JSON.stringify([ lookupKey(), x ]);
            }
        },
        verify : function (update, cb) {
            var keys = self.authorized.rows;
            
            if (Object.keys(keys).length === 0
            || Object.keys(self._authorized).length === 0) {
                // no authorized entries, let everything through by default
                return cb(null, true);
            }
            
            var sig = JSON.parse(update[3]);
            var id = sig[0];
            
            var key = (keys[id] && keys[id].state.key)
                || (self._authorized[id] && self._authorized[id])
            ;
            if (!key) {
                cb(null, false);
                self.emit.apply(self, [ 'reject' ].concat(update[0]));
                return;
            }
            
            var algo = /^-----BEGIN (\S+)/.exec(String(opts.private))[1];
            var v = crypto.createVerify(algo + '-SHA256')
                .update(JSON.stringify(update.slice(0,3)))
                .verify(key, sig[1], 'base64')
            ;
            cb(null, v);
            if (!v) self.emit.apply(self, [ 'reject' ].concat(update));
        },
    });
    
    self.services = self.doc.createSet('type', 'service');
    self.addresses = self.doc.createSet('type', 'address');
    self.authorized = self.doc.createSet('type', 'authorize');
    self.ports = {};
    
    self.doc.on('create', function (row) {
        process.nextTick(function () {
            if (self.services.has(row)) {
                self.emit('register', row.state);
            }
            if (row.state.type === 'address'
            && row.state.node === self.doc.id) {
                self.host = row.state.host;
                self.emit('host', self.host);
            }
        });
    });
     
    self.services.on('changes', function (row, changed) {
        if (changed.type === null) { // removed
            self.emit('free', row.state);
        }
    });
    
    if (opts.authorized) {
        if (!Array.isArray(opts.authorized)) {
            opts.authorized = [ opts.authorized ];
        }
        opts.authorized.forEach(function (key) {
            self.authorize(String(key));
        });
    }
}

inherits(Seaport, EventEmitter);

Seaport.prototype.createStream = function (host) {
    var self = this;
    
    var s = self.doc.createStream({
        meta : { authorized : getAuthorized() }
    });
    
    function getAuthorized () {
        var rows = Object.keys(self.authorized.rows)
            .reduce(function (acc, key) {
                acc[key] = self.authorized.rows[key].state.key;
                return acc;
            }, {})
        ;
        Object.keys(self._authorized).forEach(function (key) {
            rows[key] = self._authorized[key].key;
        });
        return rows;
    }
    
    if (!host) {
        // only non-hosts should accept metadata from clients
        
        s.on('header', function (data) {
            if (!data.meta) return;
            Object.keys(data.meta.authorized).forEach(function (key) {
                self._authorized[key] = data.meta.authorized[key];
            });
        });
        return s;
    }
    
    var id = createId();
    var nodeId;
    
    s.on('header', function (header) {
        if (header.id === self.doc.id) return;
        
        self.doc.set(id, {
            type : 'address',
            node : header.id,
            host : host,
        });
        nodeId = header.id;
    });
    
    var tr = through(write, end);
    s.on('data', tr.emit.bind(tr, 'data'));
    s.on('end', tr.emit.bind(tr, 'end'));
    s.on('synced', tr.emit.bind(tr, 'synced'));
    s.pipe(tr);
    
    return tr;
    
    function write (buf) {
        s.write(buf);
    }
    
    function end () {
        self.addresses.remove(id);
        self.services.toJSON().forEach(function (row) {
            if (row._node === nodeId) {
                self.services.remove(row);
            }
        });
    }
};

Seaport.prototype.authorize = function (pubkey) {
    this.doc.set(createId(), {
        type : 'authorize',
        key : pubkey,
    });
};

Seaport.prototype.register = function (role, opts) {
    var self = this;
    
    if (typeof role === 'object') {
        opts = role;
        role = undefined;
    }
    if (typeof opts === 'number') {
        opts = { port : opts };
    }
    if (!opts) opts = {};
    
    var meta = Object.keys(opts).reduce(function (acc, key) {
        acc[key] = opts[key];
        return acc;
    }, {});
    
    if (!meta.port) {
        var range = opts.range || [ 10000, 65535 ];
        do {
            meta.port = Math.floor(
                Math.random() * (range[1] - range[0]) + range[0]
            );
        } while (self.ports[meta.port]);
        
        self.ports[meta.port] = meta;
    }
    
    meta.role = role || meta.role;
    meta.version = meta.version || meta.role.split('@')[1];
    meta.role = meta.role.split('@')[0];
    
    meta.host = meta.host || self.host;
    
    meta.type = 'service';
    meta._node = self.doc.id;
    
    var id = meta.id = createId();
    
    if (meta.host) {
        self.doc.set(id, meta);
    }
    else {
        self.once('host', function (host) {
            meta.host = host;
            self.doc.set(id, meta);
        });
    }
    
    return meta.port;
};

Seaport.matches = matches;
function matches (rv, service) {
    if (!rv) return true;
    var role = rv.split('@')[0];
    var version = rv.split('@')[1];
    
    if (role !== service.role) return false;
    
    if (!version) return true;
    if (!semver.validRange(version)) {
        return version === service.version;
    }
    return semver.satisfies(service.version, version);
}

Seaport.prototype.query = function (rv) {
    return this.services.toJSON().filter(matches.bind(null, rv));
};

Seaport.prototype.close = function () {
    this.closed = true;
    this.emit('close');
};

Seaport.prototype.get = function (rv, cb) {
    var self = this;
    
    var ps = self.query(rv);
    if (ps.length > 0) return cb(ps);
    
    self.on('register', function onreg (service) {
        if (matches(rv, service)) {
            self.removeListener('register', onreg);
            cb(self.query(rv));
        }
    });
};

Seaport.prototype.free = function (service) {
    if (typeof service !== 'object') {
        service = this.ports[service];
    }
    this.services.remove(service.id);
};

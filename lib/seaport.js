var inherits = require('inherits');
var EventEmitter = require('events').EventEmitter;
var crypto = require('crypto');

var through = require('through');
var semver = require('semver');

var crdt = require('crdt');
var createId = require('scuttlebutt/util').createId;

module.exports = Seaport;

function Seaport (opts) {
    var self = this;
    if (!(self instanceof Seaport)) return new Seaport(opts);
    if (!opts) opts = {};
    
    self.doc = !opts.private || !opts.public ? new crdt.Doc : new(crdt.Doc)({
        sign : function (update) {
            if (opts.private) {
                return crypto.createSign(opts.private.algorithm)
                    .update(JSON.stringify(update))
                    .sign(opts.private.data, opts.private.encoding)
                ;
            }
        },
        verify : function (update, cb) {
            var keys = self.authorized.rows;
            if (Object.keys(keys).length === 0) {
                // no authorized entries, let everything through by default
                return cb(null, true);
            }
            
            var id = update[3];
            var sig = update[4];
            if (!keys[id]) {
                cb(null, false);
                self.emit.apply(self, [ 'reject' ].concat(update));
                return;
            }
            
            var v = crypto.createVerify(opts.private.algorithm)
                .update(JSON.stringify(update))
                .verify(keys[id], sig, opts.private.encoding)
            ;
            cb(null, v);
            if (!v) self.emit.apply(self, [ 'reject' ].concat(update));
        },
        createId : function () {
            return crypto.createHash(opts.public.algorithm)
                .update(opts.public.data)
                .digest(opts.public.encoding)
            ;
        },
        publicKey : opts.public.data
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
        opts.authorized.forEach(function (keys) {
            self.authorize(keys);
        });
    }
}

inherits(Seaport, EventEmitter);

Seaport.prototype.createStream = function (host) {
    var self = this;
    var s = self.doc.createStream();
    if (!host) return s;
    
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
        key : pubkey
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

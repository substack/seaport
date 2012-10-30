var inherits = require('inherits');
var EventEmitter = require('events').EventEmitter;
var through = require('through');

var crdt = require('crdt');
var createId = require('./id');

module.exports = Seaport;

function Seaport () {
    var self = this;
    if (!(self instanceof Seaport)) return new Seaport;
    
    self.doc = new(crdt.Doc);
    self.services = self.doc.createSet('type', 'service');
    self.addresses = self.doc.createSet('type', 'address');
    
    self.doc.on('create', function (row) {
        process.nextTick(function () {
            if (self.services.has(row)) {
                self.emit('allocate', row.state);
            }
            if (row.state.type === 'address'
            && row.state.node === self.doc.id) {
                self.host = row.state.host;
                self.emit('host', self.host);
            }
        });
    });
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

function buffered (fn) {
    return function () {
        var self = this, args = arguments;
        
        if (this.host) return fn.apply(self, args);
        
        this.once('host', function () {
            fn.apply(self, args);
        });
    };
}

Seaport.prototype.allocate = buffered(function (role, opts, cb) {
    if (typeof role === 'object') {
        cb = opts;
        opts = role;
        role = undefined;
    }
    if (typeof opts === 'function') {
        cb = opts;
        opts = {};
    }
    
    var meta = {
        role : role || opts.role,
        host : opts.host || this.host,
        port : opts.port,
    };
    if (!meta.port) {
        var range = opts.range || [ 10000, 65535 ];
        meta.port = Math.floor(
            Math.random() * (range[1] - range[0]) + range[0]
        );
    }
    
    meta.role = meta.role.split('@')[0];
    meta.version = meta.version || meta.role.split('@')[1];
    meta.type = 'service';
    meta._node = this.doc.id;
    
    var id = createId();
    this.doc.set(id, meta);
    
    if (typeof cb === 'function') cb(meta.port);
    return meta.port;
});

Seaport.prototype.query = function (rv, cb) {
    if (typeof rv === 'function') {
        cb = rv;
        rv = undefined;
    }
    var results = this.services.toJSON().filter(function (service) {
        if (!rv) return true;
        var role = rv.split('@')[0];
        var version = rv.split('@')[1];
        
        if (role !== service.role) return false;
        
        if (!version) return true;
        if (!semver.validRange(version)) {
            return version === service.version;
        }
        return semver.satisfies(service.version, version);
    });
    
    if (typeof cb === 'function') cb(results);
    return results;
};

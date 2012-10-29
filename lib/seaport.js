var inherits = require('inherits');
var EventEmitter = require('events').EventEmitter;

var crdt = require('crdt');
var createId = require('./id');

module.exports = Seaport;

function Seaport () {
    var self = this;
    if (!(self instanceof Seaport)) return new Seaport;
    
    self.doc = new(crdt.Doc);
    self.services = self.doc.createSet('type', 'service');
    
    self.doc.on('create', function (row) {
        process.nextTick(function () {
            self.emit('allocate', row.state);
        });
    });
    
    self.doc.on('change', function (row) {
        //console.log('onchange');
    });
    
    self.doc.on('row_update', function (row) {
        //console.dir(row);
    });
}

inherits(Seaport, EventEmitter);

Seaport.prototype.createStream = function () {
    return this.doc.createStream();
};

Seaport.prototype.allocate = function (role, opts, cb) {
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
    meta.version = meta.version
        || meta.role.split('@')[0]
        || meta.role.split('@')[1]
    ;
    meta.type = 'service';
    
    var id = createId();
    this.doc.set(id, meta);
};

Seaport.prototype.query = function () {
    return this.services.toJSON();
};

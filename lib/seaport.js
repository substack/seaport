var inherits = require('inherits');
var EventEmitter = require('events').EventEmitter;

var crdt = require('crdt');
var createId = require('./id');

module.exports = Seaport;

function Seaport () {
    if (!(this instanceof Seaport)) return new Seaport;
    
    this.doc = new(crdt.Doc);
    this.addrs = this.doc.createSet('type', 'address');
}

inherits(Seaport, EventEmitter);

Seaport.prototype.createStream = function () {
    return this.doc.createStream();
};

Seaport.prototype.allocate = function (role, meta, cb) {
    if (typeof role === 'object') {
        cb = meta;
        meta = role;
        role = undefined;
    }
    if (typeof meta === 'function') {
        cb = meta;
        meta = {};
    }
    if (role) { meta.role = role };
    
    var id = createId();
    meta.type = 'address';
    this.doc.set(id, meta);
    console.dir(this.addrs.toJSON());
};

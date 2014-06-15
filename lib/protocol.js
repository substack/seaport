var inherits = require('inherits');
var Duplex = require('readable-stream').Duplex;
var split = require('split');
var through = require('through');
var combine = require('stream-combiner');
var json = typeof JSON !== 'undefined' ? JSON : require('jsonify');

module.exports = Protocol;
inherits(Protocol, Duplex);

function Protocol (opts) {
    var self = this;
    if (!(self instanceof Protocol)) return new Protocol(opts);
    Duplex.call(self, { objectMode: true });
    if (!opts) opts = {};
    
    self.known = {};
    self.timing = {
        heartbeat: opts.heartbeat,
        timeout: opts.timeout
    };
    
    if (self.timing.heartbeat) {
        self.heartbeatInterval = setInterval(function () {
            self.send([ 'heartbeat' ]);
        }, self.timing.heartbeat);
    }
}

Protocol.prototype.send = function (row) {
    this.push(row);
};

Protocol.prototype.destroy = function () {
    clearInterval(this.heartbeatInterval);
    clearTimeout(this.timeout);
};

Protocol.prototype._write = function (row, enc, next) {
    var self = this;
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
    else if (row[0] === 'heartbeat') {
        this.emit('heartbeat');
        if (this.timing.timeout) {
            clearTimeout(this.timeout);
            this.timeout = setTimeout(function () {
                self.emit('timeout');
            }, this.timing.timeout);
        }
    }
    else if (row[0] === 'synced') {
        this.emit('synced');
    }
    next();
};

Protocol.prototype._read = function (size) {};

Protocol.prototype.createStream = function () {
    var unsplit = through(function (row) {
        this.queue(json.stringify(row) + '\n');
    });
    return combine(split(json.parse), this, unsplit);
};

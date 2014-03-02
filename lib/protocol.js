var inherits = require('inherits');
var Duplex = require('readable-stream').Duplex;

module.exports = Protocol;
inherits(Protocol, Duplex);

function Protocol () {
    Duplex.call(this, { objectMode: true });
    this.known = {};
}

Protocol.prototype.send = function (row) {
    this.push(row);
};

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

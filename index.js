var upnode = require('upnode');
var dnode = require('dnode');
var semver = require('semver');
var EventEmitter = require('events').EventEmitter;

exports.connect = function () {
    var argv = [].slice.call(arguments).reduce(function (acc, arg) {
        if (arg && typeof arg === 'object' && arg.secret) {
            acc.secret = arg.secret;
        }
        acc.args.push(arg);
        return acc;
    }, { args : [] });
    
    argv.args.push(function (remote, conn) {
        if (remote.auth) {
            remote.auth(argv.secret, function (err, res) {
                if (err) self.emit('error', new Error(err));
                else conn.emit('up', res);
            });
        }
        else conn.emit('up', remote)
    });
    
    var up = upnode.connect.apply(null, argv.args);
    
    var self = new EventEmitter;
    self.up = up;
    self.close = up.close.bind(up);
    
    [ 'free', 'query', 'assume', 'get', 'service' ]
        .forEach(function (name) {
            self[name] = function () {
                var args = [].slice.call(arguments);
                
                up(function (remote) {
                    remote[name].apply(null, args);
                });
            };
        })
    ;
    
    self.allocate = function () {
        var args = [].slice.call(arguments);
        var fn = args[args.length - 1];
        if (fn.length === 1) {
            args[args.length - 1] = function (port, ready) {
                fn(port);
                ready();
            };
        }
        
        up(function (remote) {
            remote.allocate.apply(null, args);
        });
    };
    
    self.service = function (role, params, fn) {
        if (typeof role === 'object') {
            fn = params;
            params = role;
            role = params.role;
        }
        else if (typeof params === 'function') {
            fn = params;
            params = {};
        }
        
        self.allocate(role, params, function (port, ready) {
            up.on('up', function () {
                self.assume(role, params, port);
            });
            
            fn(port, ready);
            if (fn.length === 1) ready();
        });
    };
    
    return self;
}

exports.createServer = function (opts) {
    if (typeof opts === 'function') {
        fn = opts;
        opts = {};
    }
    if (!opts) opts = {};
    if (!opts.range) opts.range = { '*' : [ 10000, 20000 ] } ;
    
    var server = dnode(function (remote, conn) {
        if (!opts.secret) return service(remote, conn);
        
        this.auth = function (secret, cb) {
            if (secret === opts.secret) cb(null, service(remote, conn))
            else cb('ACCESS DENIED')
        };
    });
    
    var ports = server.ports = {};
    var roles = server.roles = {};
    
    function service (remote, conn) {
        var self = {};
        var allocatedPorts = [];
        
        conn.on('ready', onready);
        function onready () {
            addr = conn.stream.remoteAddress;
            if (!ports[addr]) ports[addr] = [];
        }
        if (conn.stream) onready();
        
        conn.on('end', function () {
            allocatedPorts.forEach(function (port) {
                self.free(port);
            });
        });
        
        self.allocate = function (roleVer, params, cb) {
            if (typeof roleVer === 'object') {
                cb = params;
                params = roleVer;
                roleVer = params.role;
            }
            if (typeof params === 'function') {
                cb = params;
                params = {};
            }
            
            var role = roleVer.split('@')[0];
            var version = params.version || roleVer.split('@')[1] || '0.0.0';
            
            if (typeof cb !== 'function') return;
            if (!roles[role]) roles[role] = [];
            
            var r = opts.range[addr] || opts.range['*'];
            
            var port;
            if (params.port) {
                port = params.port
            }
            else {
                do {
                    port = Math.floor(Math.random() * (r[1] - r[0])) + r[0];
                } while (ports[addr][port]);
            }
            
            function ready () {
                ports[addr].push(port);
                
                params.host = addr;
                params.port = port;
                params.version = version;
                params.role = role;
                
                roles[role].push(params);
                allocatedPorts.push(port);
                
                server.emit('allocate', params);
            }
            
            cb(port, ready);
        };
        
        self.assume = function (roleVer, port, cb) {
            var params = {};
            if (typeof port === 'object') {
                params = port;
                port = params.port;
            }
            else if (typeof roleVer === 'object') {
                params = roleVer;
                roleVer = params.role;
                
                if (typeof port === 'function') {
                    cb = port;
                    port = params.port;
                }
            }
            
            var role = roleVer.split('@')[0];
            var version = params.version || roleVer.split('@')[1] || '0.0.0';
            
            var ix = ports[addr].indexOf(port);
            if (ix >= 0) ports[addr].splice(ix, 1);
            ports[addr].push(port);
            allocatedPorts.push(port);
            
            roles[role] = (roles[role] || []).filter(function (r) {
                return r.port !== port;
            });
            
            params.host = addr;
            params.port = port;
            params.role = role;
            params.version = version;
            roles[role].push(params);
            
            server.emit('assume', params);
            if (cb) cb();
        };
        
        self.free = function (port, cb) {
            if (ports[addr]) {
                var ix = ports[addr].indexOf(port);
                if (ix >= 0) ports[addr].splice(ix, 1);
            }
            
            var found;
            
            Object.keys(roles).forEach(function (role) {
                var rs = roles[role];
                roles[role] = rs.filter(function (r) {
                    var x = r.port === port && r.host === addr;
                    if (x) {
                        found = {};
                        Object.keys(r).forEach(function (key) {
                            found[key] = r[key];
                        });
                        if (!found.host) found.host = addr;
                        if (!found.port) found.port = port;
                        found.role = role;
                    }
                    return !x;
                });
            });
            
            if (typeof cb === 'function') cb();
            server.emit('free', found || { host : addr, port : port });
        };
        
        self.query = function (role, cb) {
            if (typeof role === 'function') {
                cb = role;
                role = undefined;
            }
            cb(server.query(role));
        };
        
        self.get = function (role, cb) {
            if (typeof role === 'function') {
                cb = role;
                role = undefined;
            }
            var ps = server.query(role);
            
            if (ps.length > 0) cb(ps)
            else {
                function onalloc (alloc) {
                    ps = server.query(role);
                    if (ps.length > 0) {
                        server.removeListener('allocate', onalloc);
                        server.removeListener('assume', onalloc);
                        cb(ps);
                    }
                }
                server.on('allocate', onalloc);
                server.on('assume', onalloc);
            }
        };
        
        return self;
    }
    
    server.query = function (roleVer) {
        if (roleVer === undefined) {
            return roles;
        }
        else {
            var role = roleVer.split('@')[0];
            var version = roleVer.split('@')[1];
            
            if (version === undefined) {
                return roles[role] || [];
            }
            else {
                return (roles[role] || []).filter(function (r) {
                    return semver.satisfies(r.version, version);
                });
            }
        }
    };
    
    server.use(upnode.ping);
    return server;
};

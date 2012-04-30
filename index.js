var upnode = require('upnode');
var semver = require('semver');
var EventEmitter = require('events').EventEmitter;

exports.connect = function () {
    var argv = [].slice.call(arguments).reduce(function (acc, arg) {
        if (arg && typeof arg === 'object' && arg.secret) {
            acc.secret = arg.secret;
        }
        
        if (typeof arg === 'string' && /:/.test(arg)) {
            var s = arg.split(':');
            acc.args.push(s[0], parseInt(s[1], 10));
        }
        else acc.args.push(arg);
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
    
    up.on('up', self.emit.bind(self, 'up'));
    up.on('down', self.emit.bind(self, 'down'));
    up.on('reconnect', self.emit.bind(self, 'reconnect'));
    
    [ 'free', 'query', 'assume', 'get', 'service', 'subscribe' ]
        .forEach(function (name) {
            self[name] = function () {
                var args = [].slice.call(arguments);
                
                up(function (remote) {
                    remote[name].apply(null, args);
                });
            };
        })
    ;

    // Hook into `on` method and proxy listeners for `allocate`,
    // `assume` and `free` events to the `subscribe` method instead.
    var origOn = self.on;
    self.on = function () {
        var args = [].slice.call(arguments);
        if (["allocate", "assume", "free"].indexOf(args[0]) > -1) {
            self.subscribe.apply(self, args);
        }
        else { origOn.apply(self, args); }
    };
    
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
                params.port = port;
                self.assume(role, params);
            });
            
            fn(port, ready);
            if (fn.length === 1) ready();
        });
    };
    
    return self;
}

exports.createServer = function (opts) {
    // Store references to listeners added with `subscribe`
    var clientEmitters = {allocate: [], assume: [], free: []};

    if (typeof opts === 'function') {
        fn = opts;
        opts = {};
    }
    if (!opts) opts = {};
    if (!opts.range) opts.range = { '*' : [ 10000, 20000 ] } ;
    
    var up = upnode(function (remote, conn) {
        if (!opts.secret) return service(remote, conn);
        
        this.auth = function (secret, cb) {
            if (secret === opts.secret) cb(null, service(remote, conn))
            else cb('ACCESS DENIED')
        };
    });
    var server = new EventEmitter;
    server._servers = [];
    server.up = server;
    
    // Set up remote listeners added with `subscribe`
    ["allocate", "assume", "free"].forEach(function(eventName) {
        server.on(eventName, function() {
            for(var j=0; j < clientEmitters[eventName].length; j++) {
                var emit = clientEmitters[eventName][j];
                emit.apply(this, arguments);
            }
        });
    });
    
    server.close = function () {
        server._servers.forEach(function (s) {
            s.close();
        });
    };
    
    server.listen = function () {
        server._servers.push(up.listen.apply(up, arguments));
        return server;
    };
    
    var ports = server.ports = {};
    var roles = server.roles = {};
    
    function service (remote, conn) {
        var self = {};
        var allocated = [];
        
        conn.on('ready', onready);
        function onready () {
            addr = conn.stream.remoteAddress;
            if (!ports[addr]) ports[addr] = [];
        }
        if (conn.stream) onready();
        
        conn.on('end', function () {
            allocated.forEach(function (entry) {
                self.free(entry);
            });
        });
        
        // Add remote listeners to the `allocate`, `assume`
        // or `free` events.
        self.subscribe = function (eventName, emit) {
            clientEmitters[eventName].push(emit);
            
            conn.on('end', function () {
                var ix = clientEmitters[eventName].indexOf(emit);
                if (ix >= 0) clientEmitters[eventName].splice(ix, 1);
            });
        };
        
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
                allocated.push(params);
                
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
            
            roles[role] = (roles[role] || []).filter(function (r) {
                return r.port !== port;
            });
            
            params.host = addr;
            params.port = port;
            params.role = role;
            params.version = version;
            roles[role].push(params);
            allocated.push(params);
            
            server.emit('assume', params);
            if (typeof cb === 'function') cb();
        };
        
        self.free = function (params, cb) {
            if (typeof params === 'number') {
                params = { port : params };
            }
            var port = params.port;
            var host = params.host || addr;
            
            if (ports[host]) {
                var ix = ports[host].indexOf(port);
                if (ix >= 0) ports[host].splice(ix, 1);
            }
            
            var found;
            
            Object.keys(roles).forEach(function (role) {
                var rs = roles[role];
                roles[role] = rs.filter(function (r) {
                    var x = r.port === port && r.host === host;
                    if (x) {
                        found = {};
                        Object.keys(r).forEach(function (key) {
                            found[key] = r[key];
                        });
                        if (!found.host) found.host = host;
                        if (!found.port) found.port = port;
                        found.role = role;
                    }
                    return !x;
                });
            });
            
            if (typeof cb === 'function') cb();
            if (found) server.emit('free', found);
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
            else if (!semver.validRange(version)) {
                return (roles[role] || []).filter(function (r) {
                    return version === r.version;
                });
            }
            else {
                return (roles[role] || []).filter(function (r) {
                    return semver.satisfies(r.version, version);
                });
            }
        }
    };
    
    return server;
};

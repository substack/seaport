# seaport

service registry and port assignment for clusters

[![build status](https://secure.travis-ci.org/substack/seaport.png)](http://travis-ci.org/substack/seaport)

Seaport stores `(host,port)` combos (and other metadata) for you so you won't
need to spend so much effort keeping configuration files current as your
architecture grows to span many processes on many machines. Just register your
services with seaport and then query seaport to see where your services are
running.

![crane](http://substack.net/images/seaport.png)

# example

## register a service

In this example we'll register a service with seaport and then elsewhere connect
to it.

First spin up a seaport server:

```
$ seaport listen 9090
```

then obtain a port for a server called `'web'`:

server.js:

``` js
var seaport = require('seaport');
var ports = seaport.connect('localhost', 9090);
var http = require('http');

var server = http.createServer(function (req, res) {
    res.end('beep boop\r\n');
});

server.listen(ports.register('web@1.2.3'));
```

next just `get()` that `'web'` service from another script!

client.js:

``` js
var seaport = require('seaport');
var ports = seaport.connect(9090);
var request = require('request');

ports.get('web@1.2.x', function (ps) {
    var u = 'http://' + ps[0].host + ':' + ps[0].port;
    request(u).pipe(process.stdout);
});
```

output:

```
$ node server.js &
[1] 6012
$ node client.js
beep boop
```

and if you spin up `client.js` before `server.js` then it still works because
`get()` queues the response!

## http router

In this example we'll create an http router that will route to different
versions of our application based on the http host header provided.

First we'll create a seaport server and http proxy process, `router.js`:

``` js
var seaport = require('seaport');
var server = seaport.createServer()
server.listen(5001);

var bouncy = require('bouncy');
bouncy(function (req, bounce) {
    var domains = (req.headers.host || '').split('.');
    var service = 'http@' + ({
        unstable : '0.1.x',
        stable : '0.0.x'
    }[domains[0]] || '0.0.x');
    
    var ps = server.query(service);
    
    if (ps.length === 0) {
        var res = bounce.respond();
        res.end('service not available\n');
    }
    else {
        bounce(ps[Math.floor(Math.random() * ps.length)]);
    }
}).listen(5000);
```

Now we can register different versions of the `http` process:

server_a.js:

``` js
var seaport = require('seaport');
var ports = seaport.connect('localhost', 5001);
var http = require('http');

var server = http.createServer(function (req, res) {
    res.end('version 0.0.0\r\n');
});

server.listen(ports.register('http@0.0.0'));
```

server_b.js:

``` js
var seaport = require('seaport');
var ports = seaport.connect('localhost', 5001);
var http = require('http');

var server = http.createServer(function (req, res) {
    res.end('version 0.1.0\r\n');
});

server.listen(ports.register('http@0.1.0'));
```

Now once all these processes are running, we can query the http proxy and get
back different versions of our service:

```
$ curl -H 'Host: stable' localhost:5000
version 0.0.0
$ curl -H 'Host: unstable' localhost:5000
version 0.1.0
```

## authorized keys

For security you can sign messages and maintain a list of authorized public keys
which are allowed to register services and make updates.

First make some PEM keypairs with
[rsa-json](http://github.com/substack/rsa-json):

```
$ mkdir keys
$ rsa-json > keys/hub.json
$ rsa-json > keys/web.json
```

Now we can create a seaport with an authorized keys list:

``` js
var fs = require('fs');
var publicKeys = fs.readdirSync(__dirname + '/keys')
    .filter(function (x) { return /\.json$/.test(x) })
    .map(function (x) { return require('./keys/' + x).public })
;
var seaport = require('seaport');

var opts = require('./keys/hub.json');
opts.authorized = publicKeys;

var ports = seaport.createServer(opts);
ports.listen(9090);
```

Now we can register a server with an authorized key:

``` js
var seaport = require('seaport');
var ports = seaport.connect(9090, require('./keys/web.json'));

var http = require('http');
var server = http.createServer(function (req, res) {
    res.end('beep boop\n');
});
server.listen(ports.register('web@1.2.3'));
```

No credentials are required to query the entries, only to register and update
entries. Our client can just query seaport directly:

``` js
var seaport = require('seaport');
var ports = seaport.connect(9090);
var request = require('request');

ports.get('web@1.2.x', function (ps) {
    var u = 'http://' + ps[0].host + ':' + ps[0].port;
    var r = request(u);
    
    r.pipe(process.stdout);
    r.on('end', ports.close.bind(ports));
});
```

***

```
$ node client.js
beep boop
```

# methods

```
var seaport = require('seaport')
```

All the parameters that take a `role` parameter can be intelligently versioned
with [semvers](https://github.com/isaacs/node-semver) by specifying a version in
the `role` parameter after an `'@'` character.

## var s = seaport(opts)

Create a new seaport instance.

To sign your messages, specify `opts.private` and `opts.public` as PEM-encoded
strings.

To set an initial list of authorized keys which are allowed to make updates,
pass `opts.authorized` as an array of PEM-encoded public key strings.

When the authorized key list is empty, all connected nodes may make updates.

Consider using [rsa-json](https://github.com/substack/rsa-json) to generate
the keypairs.

## var s = seaport.connect(..., opts)

Create a seaport instance piped to a tcp connection at `...`.

If the server at `...` is not available or the connection drops, the connection
is retried every second. If the seaport server is down, other hubs that
registered themselves with the role `'seaport'` are tried in a round-robin.

## var s = seaport.createServer(opts)

Create a seaport instance with an attached tcp server with `.listen()` and
`.address()` methods that will set up streams in "server mode" for incoming tcp
connections.

Internally seaport uses a heartbeat to help identify stale or orphaned service
registrations. Use `opts.heartbeat`, in milliseconds, to set the interval
that clients should update their heartbeat. The default heartbeat is `15000`.
Services will be considered stale when if they have not responded to a heartbeat
in `opts.timeout` milliseconds. The default timeout is `opts.heartbeat * 3`.

## s.createStream(host)

Create a duplex stream that implements the seaport protocol.

If `host` is specified, seaport goes into "server mode" where it stores the
`host` value on the network for the remote endpoint's node id.

## var port = s.register(role, opts)

Register the service described by the string `role`
(name@verion, version optional). Return the port to use for the service.

Registrations are valid so long as the connection to the seaport server is still
alive. When the connection to the seaport server goes down, all registrations
are freed.

You can optionally store whatever other records you want on the service by
putting those keys in `opts`.

If `opts.port` is specified, return and store that value for the service port.
Otherwise a random available port is chosen. If you want to specify a valid
range for ports to be, set `opts.range` (default: `[ 10000, 65535 ]`).

If you don't want you specify `role` you can also use `opts.role` and
`opts.version`.

You can control what the key name will be by setting `opts.id` yourself.
Otherwise a random hex string will be used.

## var meta = s.registerMeta(role, opts)

Like `s.register()`, but return the entire meta object instead of just the
`meta.port`. This is handy if you need the `id` to update metadata later.

## var services = s.query(search)

Query the seaport entries with `search` as a `name@semver` string.
The `@semver` part is optional and all the usual semver pattern matching
applies.

Returns an array of all the matching services for `search`.

If `search` is `undefined`, all the records are returned.

## s.get(role, cb)

Like `.query()`, but does `cb(services)` with the list of matching entries.
If `services` is empty, `cb` won't fire until there is at least one match
available.

## s.free(service), s.free(id)

Remove a service registered with `.register()`. You can remove a service by the
`service` object itself or just its `id`.

## s.authorize(publicKey)

Authorize the PEM-encoded `publicKey` string to make updates.
Updates include registering services and setting keys.

## s.close()

Close a seaport connection or server. Cancel any pending requests.

## s.set(id, value)

Update a registration value by its `id`, broadcasting the new registration meta
`value`.

# events

## s.on('register', function (service) {})

Emitted whenever any node registers a new service.

## s.on('free', function (service) {})

Emitted whenever any node frees a service that was previously registered.

## s.on('host', function (host) {})

In non-server mode, the client will receive notification from the server what
its `host` is on the network.

## s.on('reject', function (key, value, timestamp, source, sig) {})

Emitted when key signing fails or when a node tries to send update but is not in
the authorized key list.

## s.on('connect', function () {})

Emitted when a connection is established with `seaport.connect()`.

## s.on('disconnect', function () {})

Emitted when a connection established by `seaport.connect()` drops.

## s.on('close', function () {})

The `'close'` event fires when `s.close()` is called.

## s.on('timeout', function () {})

When the connection times out, this event fires.

# command-line usage

```
usage:

  seaport listen PORT [KEY.json, ...]

    Create a seaport server on PORT.
    Optionally load authorized public keys from json files.
    
    Key files of arrays are expected to be PEM public key lists.
    Key files are otherwise expected to have public and private fields.

  seaport show HOST:PORT

    Show the seaport records for the server running at HOST:PORT.
 
  seaport watch HOST:PORT

    Listen for register and free events from the seaport registry.
    For even more output use `-v` or `--verbose`.

  seaport query HOST:PORT PATTERN

    Run a query for PATTERN against the server running at HOST:PORT.

  seaport register HOST:PORT NAME@VERSION {OPTIONS} -- [COMMAND...]

    Register a service. COMMAND will get an assigned port to use as
    its last argument. If COMMAND exits it will be restarted.
    
    OPTIONS:
    
    --key=key.json    Load a public/private PEM keypair from key.json.
    --meta.KEY=...    Set json metadata on the service record.
 
```

# install

To get the seaport library, with [npm](http://npmjs.org) do:

```
npm install seaport
```

To get the seaport command, do:

```
npm install -g seaport
```

# license

MIT

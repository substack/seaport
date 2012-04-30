seaport
=======

service registry and port assignment for clusters

![crane](http://substack.net/images/crane.png)

example
=======

simple service
--------------

First spin up the seaport server:

```
$ seaport 9090
seaport listening on :9090
```

then obtain a port for a server called `'web'`:

server.js:

``` js
var seaport = require('seaport');
var ports = seaport.connect('localhost', 9090, { secret : 'beep boop' });
var http = require('http');

var server = http.createServer(function (req, res) {
    res.end('beep boop\r\n');
});

ports.service('web@1.2.3', function (port, ready) {
    server.listen(port, ready);
});
```

now just `get()` that `'web'` service!

client.js:

``` js
var seaport = require('seaport');
var ports = seaport.connect(9090, { secret : 'beep boop' });
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

command-line usage
==================

```
Usage:
  
  OPTIONS
  
    --secret   Use a service password for seaport connections.

  seaport port OPTIONS

    Create seaport server.

  seaport host:port show OPTIONS

    Show the port map from the server at host:port.

  seaport host:port service name@version OPTIONS -- [COMMAND...]

    Register a service. COMMAND will get an assigned port to use as
    its last argument. If COMMAND exits it will be restarted.

  seaport host:port query name@version OPTIONS

    Query the server for services matching the name@version pattern.
    The version may contain semver patterns to specify a range.
    Prints out a JSON array of host:port strings.
```

methods
=======

```
var seaport = require('seaport')
```

All the parameters that take a `role` parameter can be intelligently versioned
with [semvers](https://github.com/isaacs/node-semver) by specifying a version in
the `role` parameter after an `'@'` character.

var ports = seaport.connect(...)
--------------------------------

Connect to the seaport service at `...`.

ports.get(role, cb)
-------------------

Request an array of host/port objects through `cb(services)` that fulfill `role`.

If there are no such services then the callback `cb` will get queued until some
service fulfilling `role` gets allocated.

ports.service(role, meta={}, cb)
--------------------------------

Create a service fulfilling the role of `role`.

Receive a callback `cb(port, ready)` with the allocated `port` and `ready()`
function to call and re-assume the `port` every time the seaport service
connection gets interrupted.

You can optionally supply a metadata object `meta` that will be merged into the
result objects available when you call `.get()` or `.query()`. If you supply
`'host'` or `'port'` keys they will be overwritten.

ports.allocate(role, meta={}, cb)
---------------------------------

Request a port to fulfil a `role`. `cb(port, ready)` fires with the result.

Call `ready()` when your service is ready to start accepting connections.

If `cb.length === 1` then `ready()` will be fired automatically.

You can optionally supply a metadata object `meta` that will be merged into the
result objects available when you call `.get()` or `.query()`. If you supply
`'host'` or `'port'` keys they will be overwritten.

ports.free(port, cb)
--------------------

Give a port back. `cb(alloc)` fires when complete. You will get back the `alloc`
object that you would have gotten if you'd queried the service directly.

If `port` is an object, you can free ports on other services besides the
presently connected host by passing in a `host` field in addition to a `port`
field.

ports.assume(role, port or meta={}, cb)
---------------------------------------

Dictate to the server what port you are listening on.
This is useful for re-establishing a route without restarting the server.

You can optionally supply a metadata object `meta` that will be merged into the
result objects available when you call `.get()` or `.query()`. If you use `meta`
you must supply `meta.port` as the port argument.

Other keys used by seaport like `'host'` will be overwritten.

ports.query(role, cb)
---------------------

Get the services that satisfy the role `role` in `cb(services)`.
Everything after the `'@'` in `role` will be treated as a semver. If the semver
is invalid (but not undefined) the algorithm will resort to exact matches.

Services are just objects that look like: `{ host : '1.2.3.4', port : 5678 }`.
Services can also include metadata that you've given them.

ports.on(eventName, cb)
-----------------------

Subscribe to events (`'free'`, `'allocate'`, and `'assume'`) from the remote
seaport server. `ports` will also emit local `'up'`, `'down'`, and `'reconnect'`
events from the upnode connection.

`ports` acts like a regular EventEmitter except that data won't be sent for
remote events until you start listening for them.

Note that you won't get events while the seaport server is down so you should
probably listen for the `'up'` event from `ports` and then call `ports.query()`
if you are trying to keep a local cache of registry entries.

server methods
==============

Instead of using the command-line tool to spin up a seaport server, you can use
these api methods:

var server = seaport.createServer()
-----------------------------------

Create a new dnode seaport server.

The server emits `'allocate'`, `'assume'`, and `'free'` events when clients
allocate, assume, and free ports.

install
=======

To get the seaport library, with [npm](http://npmjs.org) do:

```
npm install seaport
```

To get the seaport command, do:

```
npm install -g seaport
```

license
=======

MIT

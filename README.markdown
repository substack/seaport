# seaport

service registry and port assignment for clusters

[![build status](https://secure.travis-ci.org/substack/seaport.png)](http://travis-ci.org/substack/seaport)

Seaport stores `(host,port)` combos (and other metadata) for you so you won't
need to spend so much effort keeping configuration files current as your
architecture grows to span many processes on many machines. Just register your
services with seaport and then query seaport to see where your services are
running.

![crane](http://substack.net/images/crane.png)

# example

## simple service

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

# command-line usage

```
usage:

  seaport listen PORT OPTIONS

    Create a seaport server on PORT.

    OPTIONS
 
      --authorize KEY.json    Load authorized keys from KEY.json.

  seaport show HOST:PORT

    Show the seaport records for the server running at HOST:PORT.

  seaport query HOST:PORT PATTERN

    Run a query for PATTERN against the server running at HOST:PORT.

  seaport register NAME@VERSION -- [COMMAND...]

    Register a service. COMMAND will get an assigned port to use as
    its last argument. If COMMAND exits it will be restarted.
 
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

var seaport = require('../../');
var s = seaport.createServer();
s.peer(9090);
s.listen(9091);

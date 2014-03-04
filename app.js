var app = require('http').createServer(handler)
  , io = require('socket.io').listen(app)
  , fs = require('fs')
  , uuid = require('node-uuid')
  , client = require('redis-url').connect(process.env.REDISTOGO_URL)
  , redis = require('redis')

var port = process.env.PORT || 5000;

console.log('about to listen on port ' + port);
app.listen(port);

function handler (req, res) {
  fs.readFile(__dirname + '/index.html',
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }

    res.writeHead(200);
    res.end(data);
  });
}


io.sockets.on('connection', function (socket) {

  do_update(socket);

  socket.on('add_item', function (data) {
    var guid = uuid.v1();
    var stripex = /(<([^>]+)>)/ig;
    var txt = data.txt.replace(stripex,'').substring(0,100);
    client.hset('listy:items', guid, JSON.stringify({ txt: txt}) , redis.print);

    do_update(socket);
  });

  socket.on('update_me', function (data) {
    do_update(socket);
  });

  socket.on('del_item', function (data) {
    guid = data.id;
    client.hdel('listy:items', guid , redis.print); 
    
    do_update(socket);
  });

  socket.on('edit', function(data) {
    var guid = data.id;
    var new_val = data.new_val;
  
    client.hget('listy:items', guid, function(err, reply) {
      rep = reply || '';

      json = JSON.parse(rep);
      json.txt = new_val;
      rep = JSON.stringify(json);

      client.hset('listy:items', guid, rep, redis.print);
      do_update(socket);
    }); 
  });
});

function do_update(s) {
    client.hgetall('listy:items', function(err, reply) {
     

      if (reply !== null) {
        var tmp = [];
        for (r in reply) {
          s_tmp = {};
          reply_json = JSON.parse(reply[r]);
          s_tmp['id'] = r;
          s_tmp['txt'] = reply_json.txt
          s_tmp['dt'] = reply_json.dt;
          s_tmp['color'] = reply_json.color || '#000';

          tmp.push(s_tmp);
        } 
        s.emit('update', tmp);
        s.broadcast.emit('update', tmp); 
      } else {
        s.emit('update', []);
        s.broadcast.emit('update', []);
     }
    });
}

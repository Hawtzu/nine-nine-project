const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const file = path.join(root, url === '/' ? 'index.html' : url);
  const ext = path.extname(file);
  const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); }
    else { res.writeHead(200, {'Content-Type': types[ext] || 'application/octet-stream'}); res.end(data); }
  });
}).listen(8080, () => console.log('Server running on http://localhost:8080'));

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
// Allowlist protects local credentials, source data, and Git metadata.
const files = new Map([['/', ['index.html','text/html']], ['/index.html',['index.html','text/html']],
  ['/app.js',['app.js','text/javascript']], ['/notebooks.js',['notebooks.js','text/javascript']],
  ['/styles.css',['styles.css','text/css']], ['/config.js',['config.js','text/javascript']],
  ['/config.public.json',['config.public.json','application/json']]]);
http.createServer(async (req,res) => {
  const item = files.get(new URL(req.url,'http://localhost').pathname);
  if (!item || !['GET','HEAD'].includes(req.method)) {res.writeHead(404); res.end(); return;}
  try { const content = await readFile(root + item[0]); res.writeHead(200, {'Content-Type': item[1]+'; charset=utf-8','Cache-Control':'no-store'}); res.end(req.method === 'HEAD' ? undefined : content); }
  catch { res.writeHead(500); res.end('Unable to load page.'); }
}).listen(5500,'127.0.0.1',()=>console.log('Study app at http://127.0.0.1:5500'));

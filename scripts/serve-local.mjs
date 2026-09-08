import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.zip':'application/zip','.json':'application/json','.png':'image/png'};
const server=http.createServer(async (req,res) => {
  try {
    let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname === '/') pathname='/workspace.html';
    const file=path.resolve(root,'.'+pathname);
    if(!file.startsWith(root+path.sep)) throw Error('path');
    const bytes=await readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(4174,'127.0.0.1',() => {console.log('Local workbench: http://127.0.0.1:4174');process.send?.('ready');});
process.on('message',message=>{if(message==='shutdown'){server.closeAllConnections();server.close(()=>process.exit(0));}});

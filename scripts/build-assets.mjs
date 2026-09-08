import {copyFile, mkdir, readFile, writeFile, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {zipSync, unzipSync} from 'fflate';
import {createHash} from 'node:crypto';
const root = fileURLToPath(new URL('..',import.meta.url));
await mkdir(path.join(root,'public/vendor'),{recursive:true});
await copyFile(path.join(root,'node_modules/pdf-lib/dist/pdf-lib.min.js'),path.join(root,'public/vendor/pdf-lib.min.js'));
await copyFile(path.join(root,'node_modules/fflate/esm/browser.js'),path.join(root,'public/vendor/fflate.mjs'));
const target=path.join(root,'build/extension');
await mkdir(path.join(target,'vendor'),{recursive:true});
for(const name of await readdir(path.join(root,'extension'))) {
  await copyFile(path.join(root,'extension',name),path.join(target,name));
}
for(const name of ['workspace.html','app.js','docx.js','styles.css','profile-core.mjs','pdf-tools.mjs','docx-template.mjs','template-workbench.mjs','resume-rewrite.mjs','install.html','wechat.html']) {
  await copyFile(path.join(root,'public',name),path.join(target,name));
}
await copyFile(path.join(root,'public/vendor/pdf-lib.min.js'),path.join(target,'vendor/pdf-lib.min.js'));
await copyFile(path.join(root,'public/vendor/fflate.mjs'),path.join(target,'vendor/fflate.mjs'));
for(const name of ['pdf-lib','fflate']) {
  const license=path.join(root,'node_modules',name,name==='pdf-lib'?'LICENSE.md':'LICENSE');
  await copyFile(license,path.join(root,'public/vendor',`${name}.LICENSE`));
  await copyFile(license,path.join(target,'vendor',`${name}.LICENSE`));
}
// Auxiliary cloud pages are linked only on the website; a local extension has no cloud origin.
let html=await readFile(path.join(target,'workspace.html'),'utf8');
html=html.replace(/<a[^>]*href="(?:wechat|install)\.html"[^>]*>[^<]*<\/a>/g,'');
html=html.replace(/<a[^>]*href="applypilot-browser-assistant\.zip"[^>]*>[^<]*<\/a>/g,'');
await writeFile(path.join(target,'workspace.html'),html);
const entries={};
async function collect(dir,prefix='extension/') {
  for(const item of await readdir(dir,{withFileTypes:true})) {
    if(item.isDirectory()) await collect(path.join(dir,item.name),prefix+item.name+'/');
    else entries[prefix+item.name]=new Uint8Array(await readFile(path.join(dir,item.name)));
  }
}
await collect(target);
const zip=zipSync(entries,{level:6,mtime:new Date('2026-01-01T00:00:00Z')});
const decoded=unzipSync(zip);
for(const [name,bytes] of Object.entries(entries)) if(!Buffer.from(bytes).equals(Buffer.from(decoded[name]))) throw Error('ZIP round-trip failed: '+name);
await writeFile(path.join(root,'public/applypilot-browser-assistant.zip'),zip);
const hash=createHash('sha256').update(zip).digest('hex');
await writeFile(path.join(root,'public/applypilot-browser-assistant.zip.sha256'),`${hash}  applypilot-browser-assistant.zip\n`);
console.log(`Built extension with local workbench (${Object.keys(entries).length} files); ZIP integrity verified. SHA256 ${hash}`);

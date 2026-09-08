import {fork} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const server=fork(new URL('serve-local.mjs',import.meta.url),[],{stdio:['ignore','inherit','inherit','ipc']});
try {
  await new Promise((resolve,reject)=>{server.once('message',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error(`Test server exited: ${code}`)));});
  const runner=fork(require.resolve('@playwright/test/cli'),['test',...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,APPLYPILOT_EXTERNAL_TEST_SERVER:'1'}});
  process.exitCode=await new Promise((resolve,reject)=>{runner.once('exit',code=>resolve(code ?? 1));runner.once('error',reject);});
} finally {
  if(server.connected)server.send('shutdown');
  const killTimer=setTimeout(()=>server.kill(),5000);killTimer.unref();
  await new Promise(resolve=>{if(server.exitCode!==null)resolve();else server.once('exit',resolve);});clearTimeout(killTimer);
}

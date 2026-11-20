import { spawn } from 'node:child_process';

const [timeout, command, ...args] = process.argv.slice(2);
const child = spawn(command, args, { detached: true, stdio: 'inherit' });
let interrupted = false;
function killTree() {
  interrupted = true;
  if (child.pid) {
    try { process.kill(-child.pid, 'SIGKILL'); } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
}
const timer = setTimeout(() => {
  console.error(`${command} の実行が ${timeout} 秒を超えました。`);
  killTree();
}, Number(timeout) * 1000);
process.on('SIGTERM', killTree);
process.on('SIGINT', killTree);
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('close', (status) => {
  clearTimeout(timer);
  process.exitCode = interrupted ? 1 : status ?? 1;
});

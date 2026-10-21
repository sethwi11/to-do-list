// Runs the API server and the Vite dev server side by side with labeled output.
// Ctrl+C stops both; if either one crashes, the other is stopped too.
import { spawn } from 'node:child_process';

const procs = [
  { name: 'server', color: 34, args: ['run', 'dev', '-w', 'server'] },
  { name: 'client', color: 32, args: ['run', 'dev', '-w', 'client'] },
];

const children = procs.map(({ name, color, args }) => {
  const child = spawn('npm', args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FORCE_COLOR: '1' } });
  const label = `\x1b[${color}m[${name}]\x1b[0m `;
  const prefix = (stream) => (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/)) if (line) stream.write(label + line + '\n');
  };
  child.stdout.on('data', prefix(process.stdout));
  child.stderr.on('data', prefix(process.stderr));
  child.on('exit', (code) => {
    console.log(`${label}exited with code ${code}`);
    shutdown(code ?? 0);
  });
  return child;
});

let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) if (c.exitCode === null) c.kill('SIGTERM');
  setTimeout(() => process.exit(code), 500);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

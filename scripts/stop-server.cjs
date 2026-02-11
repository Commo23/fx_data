/**
 * Stop processes using ports 3001, 3002, 3003 (Windows).
 * Run: npm run stop-server
 */
const { execSync } = require('child_process');
const ports = [3001, 3002, 3003];

function getPidsOnPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const pids = new Set();
    out.split('\n').forEach((line) => {
      const m = line.trim().split(/\s+/);
      const pid = m[m.length - 1];
      if (pid && /^\d+$/.test(pid)) pids.add(pid);
    });
    return [...pids];
  } catch {
    return [];
  }
}

let killed = 0;
for (const port of ports) {
  const pids = getPidsOnPort(port);
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'pipe' });
      console.log(`Port ${port}: process ${pid} stopped`);
      killed++;
    } catch (e) {
      // ignore
    }
  }
}
if (killed === 0) {
  console.log('No server process found on ports 3001, 3002, 3003.');
} else {
  console.log(`Stopped ${killed} process(es).`);
}

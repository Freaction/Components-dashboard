const { execSync } = require('child_process');

const ports = [3000, 3001];

console.log('🔍 Checking for processes on ports 3000, 3001...');

ports.forEach(port => {
  try {
    const stdout = execSync(`netstat -ano | findstr :${port}`).toString();
    const lines = stdout.split('\n');
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && !isNaN(pid) && pid !== '0') {
        console.log(`  Found process ${pid} on port ${port}. Killing...`);
        try {
          execSync(`taskkill /F /PID ${pid}`);
        } catch (e) {
          // Ignore errors if process already gone
        }
      }
    });
  } catch (e) {
    // findstr returns exit code 1 if no matches found, which is fine
  }
});

console.log('✅ Clean up complete.');

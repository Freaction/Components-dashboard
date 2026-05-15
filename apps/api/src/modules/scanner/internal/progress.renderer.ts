// A simple structure to hold the state of a task
interface Task {
  current: number;
  total: number;
  label: string;
  unit: 'bytes' | 'items';
  startTime: number;
}

class ProgressRenderer {
  private tasks = new Map<string, Task>();
  private interval: NodeJS.Timeout | null = null;
  private originalLog = console.log;
  private originalWarn = console.warn;
  private originalError = console.error;

  constructor() {
    const wrap = (original: any) => (...args: any[]) => {
      // Clear the current single line
      process.stdout.write('\r\x1b[K');
      original(...args);
      if (this.tasks.size > 0) {
        this.render();
      }
    };

    console.log = wrap(this.originalLog);
    console.warn = wrap(this.originalWarn);
    console.error = wrap(this.originalError);
  }

  public log(message: string) {
    console.log(message);
  }

  public update(key: string, label: string, current: number, total: number, unit: 'bytes' | 'items' = 'bytes') {
    if (!this.tasks.has(key)) {
      this.tasks.set(key, { label, current, total, unit, startTime: Date.now() });
      this.start();
    } else {
      const task = this.tasks.get(key)!;
      task.current = current;
      task.total = total;
    }
    this.render();
  }

  public remove(key: string) {
    if (this.tasks.has(key)) {
      const task = this.tasks.get(key)!;
      const now = Date.now();
      const elapsed = (now - task.startTime) / 1000;
      
      // Log the final result so it stays in the terminal history
      if (task.unit === 'bytes') {
        const mb = (task.current / (1024 * 1024)).toFixed(1);
        const speed = elapsed > 0 ? (task.current / (1024 * 1024) / elapsed).toFixed(1) : '0';
        this.log(`\x1b[32m✔ ${task.label}\x1b[0m: Downloaded ${mb}MB in ${elapsed.toFixed(1)}s (${speed}MB/s)`);
      } else {
        this.log(`\x1b[32m✔ ${task.label}\x1b[0m: Completed in ${elapsed.toFixed(1)}s`);
      }

      this.tasks.delete(key);
      if (this.tasks.size === 0) {
        this.stop();
      } else {
        this.render();
      }
    }
  }

  private start() {
    if (this.interval) return;
    this.interval = setInterval(() => this.render(), 200);
  }

  private stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stdout.write('\r\x1b[K');
  }

  private render() {
    if (this.tasks.size === 0) {
      process.stdout.write('\r\x1b[K');
      return;
    }

    let totalStr = '';
    const activeStr: string[] = [];
    const now = Date.now();

    for (const task of this.tasks.values()) {
      if (task.unit === 'items') {
        const percent = task.total > 0 ? Math.floor((task.current / task.total) * 100) : 0;
        const barWidth = 15;
        const filled = Math.round((percent / 100) * barWidth);
        const bar = `\x1b[32m${'█'.repeat(filled)}\x1b[90m${'─'.repeat(barWidth - filled)}\x1b[0m`;
        totalStr = `Total: ${bar} ${percent}% (${task.current}/${task.total})`;
      } else {
        const mb = (task.current / (1024 * 1024)).toFixed(1);
        const elapsed = (now - task.startTime) / 1000;
        const speed = elapsed > 0 ? (task.current / (1024 * 1024) / elapsed).toFixed(1) : '0';
        activeStr.push(`\x1b[36m${task.label}\x1b[0m: ${mb}MB (${speed}MB/s)`);
      }
    }

    const fullLine = `${totalStr}${activeStr.length > 0 ? ' | ' : ''}${activeStr.join(' | ')}`;
    
    // Prevent line wrapping which breaks \r
    const cols = process.stdout.columns || 100;
    
    // Need to account for ANSI escape codes which add length to the string but not the visible output
    // Simple naive truncate just to be safe, though ANSI makes exact column count hard
    const displayLength = fullLine.replace(/\x1b\[[0-9;]*m/g, '').length;
    let finalOutput = fullLine;
    
    if (displayLength > cols) {
       // Too long, we just append an ellipsis to the end of the string.
       // It's tricky to truncate perfectly with ANSI codes, so we rely on the terminal.
       // However, to prevent absolute wrapping disaster, we will trim active streams if needed.
       finalOutput = `${totalStr} | \x1b[33m+ ${activeStr.length} active downloads...\x1b[0m`;
    }

    process.stdout.write(`\r${finalOutput}\x1b[K`);
  }
}

export const renderer = new ProgressRenderer();

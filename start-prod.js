import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',

  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

// Function to log with timestamp and color
function log(message, color = colors.white) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors.dim}[${timestamp}]${colors.reset} ${color}${message}${colors.reset}`);
}

// Check if .env.production exists
if (!fs.existsSync(path.join(__dirname, '.env.production'))) {
  log('Warning: .env.production file not found. Some features may not work correctly.', colors.yellow);
}

// Start the proxy server
log('Starting proxy server...', colors.cyan);
const proxyServer = spawn('node', ['proxy-server.js'], {
  stdio: 'pipe',
  cwd: __dirname
});

// Handle proxy server output
proxyServer.stdout.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(line => {
    // Filter out some verbose logs to keep the console cleaner
    if (line.includes('Proxy created:') ||
        line.includes('Proxy rewrite rule created:') ||
        line.includes('Request headers:') ||
        line.includes('response headers:')) {
      return;
    }
    log(`[Proxy] ${line}`, colors.green);
  });
});

proxyServer.stderr.on('data', (data) => {
  log(`[Proxy Error] ${data.toString().trim()}`, colors.red);
});

// Wait for proxy server to start
setTimeout(() => {
  // Start the preview server
  log('Starting preview server...', colors.cyan);
  const previewServer = spawn('npm', ['run', 'preview'], {
    stdio: 'pipe',
    cwd: __dirname,
    env: { ...process.env, NODE_ENV: 'production' }
  });

  // Handle preview server output
  previewServer.stdout.on('data', (data) => {
    log(`[Preview] ${data.toString().trim()}`, colors.blue);
  });

  previewServer.stderr.on('data', (data) => {
    log(`[Preview Error] ${data.toString().trim()}`, colors.red);
  });

  // Handle process termination
  process.on('SIGINT', () => {
    log('Shutting down servers...', colors.yellow);
    previewServer.kill();
    proxyServer.kill();
    process.exit(0);
  });

  // Handle child process exit
  previewServer.on('exit', (code) => {
    log(`Preview server exited with code ${code}`, colors.yellow);
    proxyServer.kill();
    process.exit(code);
  });

  proxyServer.on('exit', (code) => {
    log(`Proxy server exited with code ${code}`, colors.yellow);
    previewServer.kill();
    process.exit(code);
  });
}, 2000); // Wait 2 seconds for proxy server to start

log('Press Ctrl+C to stop all servers', colors.magenta);

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
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
  log('Warning: .env.production file not found. Creating a default one...', colors.yellow);

  // Create a default .env.production file
  const defaultEnvContent = `# Production environment variables
NODE_ENV=production
VITE_SUPABASE_URL=https://gsuiserbzoebcdptglzm.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzdWlzZXJiem9lYmNkcHRnbHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI2NzI0NzcsImV4cCI6MjAyODI0ODQ3N30.Rl_0Vb9eBGZZkqgJZKgKQVmMnHmQVKRDRWGlC6mNIJw
VITE_PROXY_SERVER_URL=http://localhost:3001
VITE_DEEPSEEK_API_KEY=
VITE_DEMO_MODE=true
`;

  fs.writeFileSync(path.join(__dirname, '.env.production'), defaultEnvContent);
  log('Created default .env.production file', colors.green);
}

// Clean the dist directory
log('Cleaning dist directory...', colors.cyan);
try {
  if (fs.existsSync(path.join(__dirname, 'dist'))) {
    fs.rmSync(path.join(__dirname, 'dist'), { recursive: true, force: true });
  }
  log('Dist directory cleaned', colors.green);
} catch (error) {
  log(`Error cleaning dist directory: ${error.message}`, colors.red);
}

// Run the build command
log('Starting production build...', colors.cyan);
const buildProcess = spawn('npm', ['run', 'build:prod'], {
  stdio: 'pipe',
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    VITE_CHARTS_SAFE_MODE: 'true' // Enable safe mode for charts
  }
});

// Handle build process output
buildProcess.stdout.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(line => {
    log(`[Build] ${line}`, colors.blue);
  });
});

buildProcess.stderr.on('data', (data) => {
  log(`[Build Error] ${data.toString().trim()}`, colors.red);
});

// Handle build process completion
buildProcess.on('exit', (code) => {
  if (code === 0) {
    log('Production build completed successfully!', colors.green);
    log('To start the production server, run: npm run start:prod', colors.magenta);
  } else {
    log(`Production build failed with code ${code}`, colors.red);
  }
});

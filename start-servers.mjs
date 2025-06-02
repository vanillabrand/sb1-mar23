import { spawn } from 'child_process';
import { platform } from 'os';
import { existsSync } from 'fs';
import { join } from 'path';

// Determine the correct command based on the platform
const isWindows = platform() === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const cargoCmd = isWindows ? 'cargo.exe' : 'cargo';

// Check if Rust is installed
const rustApiPath = join(process.cwd(), 'backend', 'rust');
const rustInstalled = existsSync(rustApiPath);

// Start the Rust API server if available
let apiServer;
if (rustInstalled) {
  console.log('Starting Rust API server...');
  apiServer = spawn(cargoCmd, ['run', '--release'], {
    cwd: rustApiPath,
    stdio: 'inherit',
    env: {
      ...process.env,
      RUST_LOG: 'info',
      HOST: '127.0.0.1',
      PORT: '8080',
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
      DEEPSEEK_API_URL: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
      DEEPSEEK_API_KEY: process.env.VITE_DEEPSEEK_API_KEY,
      BINANCE_TESTNET_API_KEY: process.env.VITE_BINANCE_TESTNET_API_KEY,
      BINANCE_TESTNET_API_SECRET: process.env.VITE_BINANCE_TESTNET_API_SECRET,
      DEMO_MODE_ENABLED: 'true',
      ALLOWED_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173'
    }
  });
} else {
  console.log('Rust API server not found. Skipping...');
}

// Start the proxy server
console.log('Starting proxy server...');
const proxyServer = spawn(npmCmd, ['run', 'proxy'], { stdio: 'inherit' });

// Start the development server
console.log('Starting development server...');
const devServer = spawn(npmCmd, ['run', 'dev'], { stdio: 'inherit' });

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down servers...');
  if (apiServer) apiServer.kill();
  proxyServer.kill();
  devServer.kill();
  process.exit(0);
});

// Log any errors
if (apiServer) {
  apiServer.on('error', (error) => {
    console.error('API server error:', error);
  });
}

proxyServer.on('error', (error) => {
  console.error('Proxy server error:', error);
});

devServer.on('error', (error) => {
  console.error('Development server error:', error);
});

console.log(`${rustInstalled ? 'All' : 'Both'} servers are running. Press Ctrl+C to stop.`);

// Export empty object for ES module compliance
export {};

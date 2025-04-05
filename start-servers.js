import { spawn } from 'child_process';
import { platform } from 'os';

// Determine the correct command based on the platform
const isWindows = platform() === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

// Start the proxy server
console.log('Starting proxy server...');
const proxyServer = spawn(npmCmd, ['run', 'proxy'], { stdio: 'inherit' });

// Start the development server
console.log('Starting development server...');
const devServer = spawn(npmCmd, ['run', 'dev'], { stdio: 'inherit' });

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down servers...');
  proxyServer.kill();
  devServer.kill();
  process.exit(0);
});

// Log any errors
proxyServer.on('error', (error) => {
  console.error('Proxy server error:', error);
});

devServer.on('error', (error) => {
  console.error('Development server error:', error);
});

console.log('Both servers are running. Press Ctrl+C to stop.');

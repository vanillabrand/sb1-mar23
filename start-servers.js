import { spawn, exec } from 'child_process';
import { platform } from 'os';
import { existsSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Determine the correct command based on the platform
const isWindows = platform() === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const cargoCmd = isWindows ? 'cargo.exe' : 'cargo';

// Check if Rust project exists
const rustApiPath = join(process.cwd(), 'backend', 'rust');
const rustProjectExists = existsSync(rustApiPath) && existsSync(join(rustApiPath, 'Cargo.toml'));

// Function to check if Rust/Cargo is installed
async function checkRustInstallation() {
  try {
    await execAsync(`${cargoCmd} --version`);
    return true;
  } catch (error) {
    return false;
  }
}

// Function to install Rust
async function installRust() {
  console.log('🦀 Rust not found. Installing Rust...');
  console.log('This may take a few minutes...');

  try {
    if (isWindows) {
      // On Windows, download and run rustup-init.exe
      console.log('Please visit https://rustup.rs/ to install Rust on Windows');
      console.log('Or run: winget install Rustlang.Rustup');
      return false;
    } else {
      // On Unix-like systems, use the official installer
      await execAsync('curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y');

      // Source the cargo environment
      process.env.PATH = `${process.env.HOME}/.cargo/bin:${process.env.PATH}`;

      console.log('✅ Rust installed successfully!');
      return true;
    }
  } catch (error) {
    console.error('❌ Failed to install Rust:', error.message);
    console.log('Please install Rust manually from https://rustup.rs/');
    return false;
  }
}

// Main startup function
async function startServers() {
  let apiServer;

  // Check if Rust project exists and Rust is installed
  if (rustProjectExists) {
    console.log('🦀 Rust API project found. Checking Rust installation...');

    const rustInstalled = await checkRustInstallation();

    if (!rustInstalled) {
      console.log('⚠️  Rust/Cargo not found in PATH.');
      console.log('📦 The application will work without the Rust API, but some features may be limited.');
      console.log('');
      console.log('To install Rust:');
      console.log('  • Visit: https://rustup.rs/');
      console.log('  • Or run: curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh');
      console.log('  • Then restart the application');
      console.log('');

      // Ask if user wants to auto-install (on non-Windows systems)
      if (!isWindows && process.env.AUTO_INSTALL_RUST === 'true') {
        const installed = await installRust();
        if (installed) {
          console.log('🚀 Starting Rust API server...');
          apiServer = await startRustApi();
        }
      }
    } else {
      console.log('✅ Rust installation found. Starting Rust API server...');
      apiServer = await startRustApi();
    }
  } else {
    console.log('ℹ️  Rust API project not found. Skipping...');
  }

  // Start the proxy server
  console.log('🔄 Starting proxy server...');
  const proxyServer = spawn(npmCmd, ['run', 'proxy'], { stdio: 'inherit' });

  // Start the development server
  console.log('⚡ Starting development server...');
  const devServer = spawn(npmCmd, ['run', 'dev'], { stdio: 'inherit' });

  return { apiServer, proxyServer, devServer };
}

// Function to start the Rust API server
async function startRustApi() {
  try {
    const apiServer = spawn(cargoCmd, ['run', '--bin', 'trading-api', '--release'], {
      cwd: rustApiPath,
      stdio: 'inherit',
      env: {
        ...process.env,
        RUST_LOG: 'info',
        HOST: '127.0.0.1',
        PORT: '3000',
        // Supabase Configuration
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
        // DeepSeek Configuration
        VITE_DEEPSEEK_API_KEY: process.env.VITE_DEEPSEEK_API_KEY,
        DEEPSEEK_API_URL: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
        // Binance TestNet Configuration
        VITE_BINANCE_TESTNET_API_KEY: process.env.VITE_BINANCE_TESTNET_API_KEY,
        VITE_BINANCE_TESTNET_API_SECRET: process.env.VITE_BINANCE_TESTNET_API_SECRET,
        VITE_BINANCE_FUTURES_TESTNET_API_KEY: process.env.VITE_BINANCE_FUTURES_TESTNET_API_KEY,
        VITE_BINANCE_FUTURES_TESTNET_API_SECRET: process.env.VITE_BINANCE_FUTURES_TESTNET_API_SECRET,
        // Exchange URLs
        VITE_BINANCE_BASE_URL: process.env.VITE_BINANCE_BASE_URL,
        VITE_BINANCE_TESTNET_BASE_URL: process.env.VITE_BINANCE_TESTNET_BASE_URL,
        VITE_BINANCE_FUTURES_TESTNET_BASE_URL: process.env.VITE_BINANCE_FUTURES_TESTNET_BASE_URL,
        VITE_BINANCE_TESTNET_WEBSOCKETS_URL: process.env.VITE_BINANCE_TESTNET_WEBSOCKETS_URL,
        // Demo Configuration
        DEMO_MODE_ENABLED: 'true',
        TRADING_ENABLED: 'true',
        // CORS Configuration
        ALLOWED_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174'
      }
    });

    // Add error handler for the process
    apiServer.on('error', (error) => {
      console.error('❌ Rust API server error:', error.message);
      console.log('🔄 Continuing without Rust API server...');
    });

    apiServer.on('exit', (code, signal) => {
      if (code !== 0) {
        console.log(`⚠️  Rust API server exited with code ${code}`);
      }
    });

    return apiServer;
  } catch (error) {
    console.error('❌ Failed to start Rust API server:', error.message);
    console.log('🔄 Continuing without Rust API server...');
    return null;
  }
}

// Start all servers
startServers().then(({ apiServer, proxyServer, devServer }) => {
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('🛑 Shutting down servers...');
    if (apiServer) {
      console.log('🦀 Stopping Rust API server...');
      apiServer.kill();
    }
    console.log('🔄 Stopping proxy server...');
    proxyServer.kill();
    console.log('⚡ Stopping development server...');
    devServer.kill();
    process.exit(0);
  });

  // Log any errors
  if (apiServer) {
    apiServer.on('error', (error) => {
      console.error('❌ API server error:', error);
    });
  }

  proxyServer.on('error', (error) => {
    console.error('❌ Proxy server error:', error);
  });

  devServer.on('error', (error) => {
    console.error('❌ Development server error:', error);
  });

  // Success message
  const serverCount = apiServer ? 'All three' : 'Both';
  const serverList = apiServer ? 'Rust API, Proxy, and Vite Dev' : 'Proxy and Vite Dev';

  console.log('');
  console.log('🎉 Servers started successfully!');
  console.log(`📡 ${serverCount} servers (${serverList}) are running.`);
  console.log('');
  console.log('🌐 Frontend: http://localhost:5173');
  console.log('🔄 Proxy: http://localhost:3001');
  if (apiServer) {
    console.log('🦀 Rust API: http://localhost:3000');
  }
  console.log('');
  console.log('Press Ctrl+C to stop all servers.');
}).catch((error) => {
  console.error('❌ Failed to start servers:', error);
  process.exit(1);
});

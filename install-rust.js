#!/usr/bin/env node

import { exec } from 'child_process';
import { platform } from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);
const isWindows = platform() === 'win32';

console.log('🦀 Rust Installation Script');
console.log('==========================');
console.log('');

async function checkRustInstallation() {
  try {
    const { stdout } = await execAsync('cargo --version');
    console.log('✅ Rust is already installed!');
    console.log(`📦 ${stdout.trim()}`);
    return true;
  } catch (error) {
    return false;
  }
}

async function installRust() {
  console.log('🔧 Installing Rust...');
  console.log('This may take a few minutes...');
  console.log('');

  try {
    if (isWindows) {
      console.log('🪟 Windows detected.');
      console.log('');
      console.log('Please choose one of the following options:');
      console.log('');
      console.log('Option 1 - Manual Installation:');
      console.log('  1. Visit: https://rustup.rs/');
      console.log('  2. Download and run rustup-init.exe');
      console.log('  3. Follow the installation prompts');
      console.log('');
      console.log('Option 2 - Using Windows Package Manager:');
      console.log('  Run: winget install Rustlang.Rustup');
      console.log('');
      console.log('Option 3 - Using Chocolatey:');
      console.log('  Run: choco install rust');
      console.log('');
      console.log('After installation, restart your terminal and run "npm run start" again.');
      return false;
    } else {
      console.log('🐧 Unix-like system detected. Installing Rust via rustup...');
      
      // Download and run the rustup installer
      await execAsync('curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y');
      
      console.log('✅ Rust installed successfully!');
      console.log('');
      console.log('🔄 Updating PATH...');
      
      // Update PATH for current session
      process.env.PATH = `${process.env.HOME}/.cargo/bin:${process.env.PATH}`;
      
      // Verify installation
      try {
        const { stdout } = await execAsync('cargo --version');
        console.log(`📦 ${stdout.trim()}`);
        console.log('');
        console.log('🎉 Installation complete!');
        console.log('You can now run "npm run start" to start the application with Rust API support.');
        return true;
      } catch (verifyError) {
        console.log('⚠️  Installation completed but cargo is not in PATH.');
        console.log('Please restart your terminal or run:');
        console.log('  source ~/.cargo/env');
        return false;
      }
    }
  } catch (error) {
    console.error('❌ Failed to install Rust:', error.message);
    console.log('');
    console.log('Please install Rust manually:');
    console.log('  • Visit: https://rustup.rs/');
    console.log('  • Follow the installation instructions for your platform');
    return false;
  }
}

async function main() {
  const isInstalled = await checkRustInstallation();
  
  if (!isInstalled) {
    console.log('🔍 Rust not found. Starting installation...');
    console.log('');
    await installRust();
  }
  
  console.log('');
  console.log('📚 Additional Information:');
  console.log('  • Rust Documentation: https://doc.rust-lang.org/');
  console.log('  • Cargo Book: https://doc.rust-lang.org/cargo/');
  console.log('  • Rustup Documentation: https://rust-lang.github.io/rustup/');
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

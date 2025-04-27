const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Path to the Netlify functions directory
const functionsDir = path.join(__dirname, 'netlify', 'functions');

// Check if the directory exists
if (!fs.existsSync(functionsDir)) {
  console.error(`Netlify functions directory not found: ${functionsDir}`);
  process.exit(1);
}

// Install dependencies
try {
  console.log('Installing Netlify functions dependencies...');
  execSync('npm install', { cwd: functionsDir, stdio: 'inherit' });
  console.log('Netlify functions dependencies installed successfully!');
} catch (error) {
  console.error('Failed to install Netlify functions dependencies:', error);
  process.exit(1);
}

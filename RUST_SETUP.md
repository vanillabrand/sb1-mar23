# 🦀 Rust API Setup Guide

This guide explains how to set up and run the Rust API backend as part of the crypto trading application.

## 🚀 Quick Start

### Option 1: Automatic Setup (Recommended)
```bash
# Install dependencies and Rust in one command
npm run setup

# Start all servers (including Rust API if available)
npm run start
```

### Option 2: Manual Setup
```bash
# Install Rust manually
npm run install-rust

# Or visit https://rustup.rs/ and follow instructions

# Start all servers
npm run start
```

## 📋 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run start` | Start all servers (Rust API, Proxy, Frontend) |
| `npm run install-rust` | Install Rust automatically (Unix/Linux/macOS) |
| `npm run setup` | Install npm dependencies + Rust |
| `npm run api` | Run only the Rust API server |

## 🔧 What the Startup Script Does

1. **🔍 Detects Rust Installation**: Checks if Rust/Cargo is available
2. **📦 Smart Fallback**: Runs without Rust API if not available
3. **🚀 Starts All Services**: 
   - Rust API (port 8080) - if available
   - Proxy Server (port 3001)
   - Frontend Dev Server (port 5173)
4. **📊 Clear Status**: Shows which servers are running

## 🌐 Server URLs

When all servers are running:
- **Frontend**: http://localhost:5173
- **Proxy**: http://localhost:3001  
- **Rust API**: http://localhost:8080

## 🛠️ Rust Installation Details

### Automatic Installation (Unix/Linux/macOS)
The `npm run install-rust` script will:
- Download and run the official Rust installer
- Set up the Rust toolchain
- Update your PATH automatically
- Verify the installation

### Manual Installation
Visit [rustup.rs](https://rustup.rs/) and follow the platform-specific instructions:

**Unix/Linux/macOS:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

**Windows:**
- Download rustup-init.exe from rustup.rs
- Or use: `winget install Rustlang.Rustup`
- Or use: `choco install rust`

## 🔄 Development Workflow

1. **First Time Setup:**
   ```bash
   npm install
   npm run install-rust  # if Rust not installed
   npm run start
   ```

2. **Daily Development:**
   ```bash
   npm run start  # Starts all servers
   ```

3. **Frontend Only** (if Rust API issues):
   ```bash
   npm run start:legacy  # Proxy + Frontend only
   ```

## 🐛 Troubleshooting

### Rust Not Found
If you see "Rust/Cargo not found in PATH":
1. Install Rust: `npm run install-rust`
2. Restart your terminal
3. Run `npm run start` again

### Rust API Compilation Errors
The application will work without the Rust API. The frontend uses fallback mechanisms:
- API calls fall back to direct Supabase access
- All core functionality remains available

### PATH Issues
If Rust is installed but not found:
```bash
# Add to your shell profile (.bashrc, .zshrc, etc.)
export PATH="$HOME/.cargo/bin:$PATH"

# Or source the cargo environment
source ~/.cargo/env
```

## 📁 Project Structure

```
backend/rust/
├── Cargo.toml          # Rust dependencies
├── src/
│   ├── main.rs         # Main application
│   ├── config.rs       # Configuration
│   ├── error.rs        # Error handling
│   ├── api/            # API routes
│   ├── db/             # Database modules
│   ├── models/         # Data models
│   ├── services/       # Business logic
│   └── ws/             # WebSocket handling
```

## 🎯 Benefits of Rust API

When the Rust API is running, you get:
- **⚡ High Performance**: Faster API responses
- **🔒 Memory Safety**: Rust's safety guarantees
- **🚀 Concurrency**: Excellent async performance
- **📊 Metrics**: Built-in Prometheus metrics
- **🔄 WebSockets**: Real-time data streaming

## 🔗 Related Documentation

- [Rust Documentation](https://doc.rust-lang.org/)
- [Cargo Book](https://doc.rust-lang.org/cargo/)
- [Actix Web Framework](https://actix.rs/)
- [Rustup Documentation](https://rust-lang.github.io/rustup/)

#!/bin/bash

# Trading API Startup Script
# This script starts the Rust trading API with proper configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[TRADING-API]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[TRADING-API]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[TRADING-API]${NC} $1"
}

print_error() {
    echo -e "${RED}[TRADING-API]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "Cargo.toml" ]; then
    print_error "Cargo.toml not found. Please run this script from the backend/rust directory."
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Copying from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_success "Created .env file from template"
        print_warning "Please configure your environment variables in .env before running again"
        exit 1
    else
        print_error ".env.example not found. Please create a .env file with required configuration."
        exit 1
    fi
fi

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    print_error "Cargo not found. Please install Rust: https://rustup.rs/"
    exit 1
fi

# Set default environment variables if not set
export RUST_LOG=${RUST_LOG:-info}
export HOST=${HOST:-127.0.0.1}
export PORT=${PORT:-3000}

print_status "Starting Trading API..."
print_status "Environment: ${ENVIRONMENT:-development}"
print_status "Host: $HOST"
print_status "Port: $PORT"
print_status "Log Level: $RUST_LOG"

# Check if we should build first
if [ "$1" = "--build" ] || [ ! -f "target/release/trading-api" ]; then
    print_status "Building Trading API..."
    cargo build --release --bin trading-api
    if [ $? -eq 0 ]; then
        print_success "Build completed successfully"
    else
        print_error "Build failed"
        exit 1
    fi
fi

# Start the API
print_status "Starting Trading API server..."
exec cargo run --release --bin trading-api

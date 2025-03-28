#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status messages
print_status() {
    echo -e "${GREEN}[✓] $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[!] $1${NC}"
}

print_error() {
    echo -e "${RED}[✗] $1${NC}"
}

# Function to check if a command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 is required but not installed."
        exit 1
    fi
}

# Check for required commands
check_command "node"
check_command "npm"

# Function to check if .env exists and create if not
setup_env() {
    if [ ! -f ".env" ]; then
        print_warning "No .env file found. Creating from .env.example..."
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_status "Created .env file. Please update with your configuration."
        else
            print_error ".env.example not found!"
            exit 1
        fi
    fi
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    npm install
    
    # Install required global packages
    if ! command -v pm2 &> /dev/null; then
        print_warning "Installing PM2 globally..."
        npm install -g pm2
    fi
    
    if ! command -v ts-node &> /dev/null; then
        print_warning "Installing ts-node globally..."
        npm install -g ts-node
    fi
    
    if ! command -v nodemon &> /dev/null; then
        print_warning "Installing nodemon globally..."
        npm install -g nodemon
    fi
}

# Function to build the frontend
build_frontend() {
    print_status "Building frontend..."
    npm run build
}

# Function to start development environment
start_dev() {
    print_status "Starting development environment..."
    npm run dev
}

# Function to start production environment
start_prod() {
    print_status "Starting production environment..."
    
    # Build frontend
    build_frontend
    
    # Start frontend using PM2
    print_status "Starting frontend server..."
    pm2 delete frontend-server &>/dev/null || true
    pm2 serve dist 5173 --name frontend-server --spa
    
    # Display status
    pm2 status
    
    # Monitor logs
    print_status "Monitoring logs... (Ctrl+C to exit)"
    pm2 logs
}

# Main script
main() {
    # Setup environment
    setup_env
    
    # Install dependencies
    install_dependencies
    
    # Check environment
    if [ "$NODE_ENV" = "production" ]; then
        start_prod
    else
        start_dev
    fi
}

# Parse command line arguments
case "$1" in
    "dev")
        export NODE_ENV=development
        main
        ;;
    "prod")
        export NODE_ENV=production
        main
        ;;
    "stop")
        pm2 delete all
        print_status "Stopped all processes"
        ;;
    *)
        echo "Usage: $0 {dev|prod|stop}"
        echo "  dev  - Start development environment"
        echo "  prod - Start production environment"
        echo "  stop - Stop all processes"
        exit 1
        ;;
esac

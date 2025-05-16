# GiGAntic Trading Platform

## High-Performance API

This project now includes a high-performance server-side API built with Rust that handles all the functions of the current app, with a focus on low latency, security, and proper integration with the frontend.

## Setup and Installation

### Clean Installation
```bash
# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
npm install
```

### Building and Running
```bash
# Build the project
npm run build

# Start in development mode
./scripts/run.sh dev

# Start in production mode
./scripts/run.sh prod
```

## API Documentation

### Rust API Server

The application now includes a high-performance API server built with Rust. This server provides a comprehensive set of endpoints for all trading functionality, with WebSocket support for real-time updates.

#### Key Features:
- **High Performance**: Built with Rust for maximum performance and memory safety
- **Complete API**: Handles all app functionality including trading, asset monitoring, market conditions, and strategy adaptation
- **WebSocket Support**: Real-time data streaming for market updates and trade notifications
- **Supabase Integration**: Seamless integration with the existing database
- **Authentication**: JWT-based authentication with Supabase Auth

#### Endpoints:
- `/api/strategies` - Strategy management (create, read, update, delete, activate, deactivate)
- `/api/trades` - Trade execution and monitoring
- `/api/market` - Market data retrieval
- `/api/exchanges` - Exchange integration
- `/api/news` - News retrieval
- `/api/auth` - Authentication

#### WebSocket:
- `ws://localhost:8080/ws` - WebSocket endpoint for real-time updates

### Proxy Server
The application uses a proxy server to avoid CORS issues when making API requests to external services. The proxy server is automatically started when running the application.

#### Endpoints:

- `/api/proxy/*` - General purpose proxy for any API request
- `/api/binance/*` - Proxy for Binance API requests
- `/api/kraken/*` - Proxy for Kraken API requests through CCXT
- `/api/kraken-direct/*` - Direct proxy for Kraken API requests (bypasses CCXT)
- `/api/bitmart/*` - Proxy for BitMart API requests
- `/api/coinbase/*` - Proxy for Coinbase API requests
- `/api/deepseek/*` - Proxy for Deepseek API requests

### Kraken Direct API

The Kraken Direct API provides direct access to the Kraken API without going through CCXT. This can be useful for accessing endpoints that are not supported by CCXT or for better performance.

#### Public Endpoints:
- `/api/kraken-direct/public/Time` - Get server time
- `/api/kraken-direct/public/Assets` - Get asset info
- `/api/kraken-direct/public/AssetPairs` - Get tradable asset pairs
- `/api/kraken-direct/public/Ticker` - Get ticker information
- `/api/kraken-direct/public/OHLC` - Get OHLC data
- `/api/kraken-direct/public/Depth` - Get order book
- `/api/kraken-direct/public/Trades` - Get recent trades

#### Private Endpoints:
- `/api/kraken-direct/private/Balance` - Get account balance
- `/api/kraken-direct/private/TradeBalance` - Get trade balance
- `/api/kraken-direct/private/OpenOrders` - Get open orders
- `/api/kraken-direct/private/ClosedOrders` - Get closed orders
- `/api/kraken-direct/private/QueryOrders` - Query orders info
- `/api/kraken-direct/private/TradesHistory` - Get trades history
- `/api/kraken-direct/private/AddOrder` - Add a new order
- `/api/kraken-direct/private/CancelOrder` - Cancel an open order
- `/api/kraken-direct/private/CancelAll` - Cancel all open orders

For more information, see the [Kraken API documentation](https://docs.kraken.com/rest/).

## Exchange Management

The application supports multiple exchanges and allows users to set a default exchange and an active exchange.

- **Default Exchange**: The exchange that is used by default when no specific exchange is selected.
- **Active Exchange**: The exchange that is currently being used for trading operations.

Exchange credentials are stored securely in the database and are encrypted before being stored.

## WebSocket Support

The application uses WebSockets for real-time data updates from exchanges and the API server. WebSocket connections are automatically established when connecting to an exchange or when using the application.

### Exchange WebSockets
WebSocket connections to exchanges are automatically established when connecting to an exchange. These provide real-time market data and trade updates directly from the exchange.

### API Server WebSockets
The Rust API server provides a WebSocket endpoint at `ws://localhost:8080/ws` for real-time updates. This includes:

- Strategy updates
- Trade notifications
- Market data
- Connection status

The WebSocket client in the frontend automatically handles reconnection, authentication, and message processing.

## Demo Mode

The application supports a demo mode that uses the Binance TestNet for trading operations. This allows users to test the application without using real funds.

To enable demo mode, set the `DEMO_MODE` environment variable to `true`.


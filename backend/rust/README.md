# Trading API - Production-Ready Rust Backend

A high-performance, production-ready trading API built with Rust and Actix-web, featuring comprehensive trading functionality, real-time WebSocket support, and enterprise-grade monitoring.

## 🚀 Features

### Core Trading Features
- **Strategy Management**: Create, update, activate/deactivate trading strategies
- **Trade Execution**: Execute, monitor, and close trades with real-time updates
- **Exchange Integration**: Support for multiple exchanges (Binance, ByBit, Bitmart, etc.)
- **Market Data**: Real-time market data and price feeds
- **Risk Management**: Comprehensive risk controls and budget management

### Production Features
- **High Performance**: Built with Rust for maximum performance and safety
- **Real-time Updates**: WebSocket support for live data streaming
- **Monitoring**: Prometheus metrics and health checks
- **Security**: JWT authentication, rate limiting, and CORS protection
- **Database**: Supabase integration with connection pooling
- **AI Integration**: DeepSeek AI for market insights and trade generation
- **Containerization**: Docker support for easy deployment

## 🏗️ Architecture

```
├── src/
│   ├── api/                 # HTTP API layer
│   │   ├── handlers/        # Request handlers
│   │   ├── middleware/      # Custom middleware
│   │   └── routes.rs        # Route definitions
│   ├── db/                  # Database layer
│   │   └── supabase.rs      # Supabase client
│   ├── models/              # Data models
│   ├── services/            # Business logic
│   │   ├── strategy_service.rs
│   │   ├── trade_service.rs
│   │   ├── exchange_service.rs
│   │   └── deepseek_service.rs
│   ├── ws/                  # WebSocket server
│   ├── config.rs            # Configuration management
│   ├── error.rs             # Error handling
│   └── main.rs              # Application entry point
```

## 🛠️ Installation & Setup

### Prerequisites
- Rust 1.75+ 
- Docker (optional)
- Supabase account
- DeepSeek API key (optional)

### Environment Setup

1. **Clone and navigate to the project:**
```bash
cd backend/rust
```

2. **Copy environment template:**
```bash
cp .env.example .env
```

3. **Configure environment variables:**
```bash
# Required - Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Optional - AI Integration
VITE_DEEPSEEK_API_KEY=your-deepseek-api-key

# Optional - Exchange APIs
BINANCE_API_KEY=your-binance-api-key
BINANCE_API_SECRET=your-binance-api-secret

# Security
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
```

### Development

1. **Install dependencies and run:**
```bash
cargo run --release --bin trading-api
```

2. **The API will start on:**
```
http://127.0.0.1:3000
```

### Production Deployment

#### Docker Deployment
```bash
# Build the image
docker build -t trading-api .

# Run with docker-compose
docker-compose up -d
```

#### Manual Deployment
```bash
# Build release binary
cargo build --release

# Run the binary
./target/release/trading-api
```

## 📡 API Endpoints

### Health & Monitoring
- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics

### Strategy Management
- `GET /api/strategies` - List strategies
- `POST /api/strategies` - Create strategy
- `GET /api/strategies/{id}` - Get strategy
- `PUT /api/strategies/{id}` - Update strategy
- `DELETE /api/strategies/{id}` - Delete strategy
- `POST /api/strategies/{id}/activate` - Activate strategy
- `POST /api/strategies/{id}/deactivate` - Deactivate strategy

### Trade Management
- `GET /api/trades` - List trades
- `POST /api/trades` - Create trade
- `GET /api/trades/{id}` - Get trade
- `PUT /api/trades/{id}` - Update trade
- `DELETE /api/trades/{id}` - Delete trade
- `POST /api/trades/{id}/execute` - Execute trade
- `POST /api/trades/{id}/close` - Close trade

### Exchange Operations
- `GET /api/exchange/balance` - Get account balance
- `POST /api/exchange/order` - Create order
- `DELETE /api/exchange/order/{id}` - Cancel order
- `GET /api/exchange/orders` - Get open orders

## 🔧 Configuration

### Server Configuration
```env
HOST=127.0.0.1
PORT=3000
WORKERS=4
MAX_CONNECTIONS=1000
```

### Security Configuration
```env
JWT_SECRET=your-secret-key
RATE_LIMIT_RPM=100
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Database Configuration
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 📊 Monitoring

### Health Checks
```bash
curl http://localhost:3000/health
```

### Prometheus Metrics
```bash
curl http://localhost:3000/metrics
```

### Logging
The API uses structured logging with configurable levels:
```env
RUST_LOG=info
LOG_FORMAT=json
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Configurable request rate limiting
- **CORS Protection**: Cross-origin request security
- **Input Validation**: Comprehensive request validation
- **Error Handling**: Secure error responses

## 🚀 Performance

- **Async/Await**: Non-blocking I/O operations
- **Connection Pooling**: Efficient database connections
- **Memory Safety**: Rust's ownership system prevents memory leaks
- **Zero-Cost Abstractions**: High-level code with low-level performance

## 🧪 Testing

```bash
# Run tests
cargo test

# Run with coverage
cargo test --coverage

# Integration tests
cargo test --test integration
```

## 📝 Development

### Code Quality
```bash
# Format code
cargo fmt

# Lint code
cargo clippy

# Check compilation
cargo check
```

### Adding New Features
1. Add models in `src/models/`
2. Implement business logic in `src/services/`
3. Create handlers in `src/api/handlers/`
4. Register routes in `src/api/routes.rs`
5. Add tests

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the logs: `docker logs trading-api`
- Health check: `curl http://localhost:3000/health`
- Metrics: `curl http://localhost:3000/metrics`

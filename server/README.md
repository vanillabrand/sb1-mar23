# Crypto Trading Platform Proxy Server

This is a simple proxy server for the crypto trading platform. It handles API requests that would otherwise be blocked by CORS policies when made directly from the browser.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file in the server directory with the following content:
   ```
   PROXY_PORT=3001
   ```

3. Start the server:
   ```
   npm start
   ```

## Endpoints

### Health Check
- `GET /health`: Returns a 200 OK response if the server is running.

### News API Proxy
- `GET /api/news`: Proxies requests to the Coindesk API.
  - Query parameters:
    - `asset`: The asset to fetch news for (e.g., BTC, ETH)
    - `apiKey`: The API key for the Coindesk API

## Usage

The proxy server should be running whenever you're using the main application. The main application will automatically route API requests through this proxy to avoid CORS issues.

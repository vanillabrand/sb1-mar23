# Exchange Setup Guide

This guide will help you set up and connect to cryptocurrency exchanges in the application.

## Setting Up Binance Connection

### Prerequisites

1. A Binance account (or Binance TestNet account for testing)
2. API keys with appropriate permissions
3. The proxy server running (for handling API requests)

### Step 1: Start the Proxy Server

The proxy server helps bypass CORS issues and network restrictions when connecting to exchange APIs.

```bash
# Navigate to the project directory
cd your-project-directory

# Start the proxy server
node proxy-server.js
```

You should see a message indicating the proxy server is running on port 3001.

### Step 2: Create API Keys

#### For Binance TestNet (Recommended for Testing)

1. Go to [Binance TestNet](https://testnet.binance.vision/)
2. Create an account or log in
3. Generate API keys with "Read" permissions at minimum
4. Save your API Key and Secret Key securely

#### For Binance Main Network

1. Log in to your Binance account
2. Navigate to API Management
3. Create a new API key with at least "Read" permissions
4. Complete any security verifications required
5. Save your API Key and Secret Key securely

### Step 3: Add Exchange in the Application

1. Open the application and navigate to the Exchange Manager
2. Click "Add Exchange"
3. Select "Binance" from the dropdown
4. Enter your API Key and Secret Key
5. Check "Use TestNet" if you're using Binance TestNet
6. Click "Add Exchange"

### Troubleshooting Connection Issues

If you encounter the error "Connection test failed: binance GET https://api.binance.com/... fetch failed":

1. **Check Proxy Server**: Ensure the proxy server is running on port 3001
2. **Network Restrictions**: Some regions restrict access to Binance. Try using a VPN
3. **API Permissions**: Verify your API keys have the correct permissions
4. **TestNet Mode**: Try using TestNet mode by checking the "Use TestNet" option
5. **API Key Format**: Double-check that your API key and secret are entered correctly

## Using Other Exchanges

The application supports multiple exchanges including:

- Binance
- Bybit
- BitMart
- Coinbase
- Kraken

The setup process is similar for all exchanges, but API key generation will differ. Refer to each exchange's documentation for specific instructions on creating API keys.

## Security Considerations

- Never share your API keys
- Use API keys with the minimum permissions required
- Consider using IP restrictions for your API keys
- For testing, always use TestNet when available

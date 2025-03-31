# Using Binance TestNet for Trading

This guide explains how to set up and use Binance TestNet for real trading functionality in demo mode.

## What is Binance TestNet?

Binance TestNet is a sandbox environment that mimics the real Binance exchange. It allows you to:

- Test trading strategies with real market data
- Execute trades without using real money
- Experience the full trading functionality in a safe environment

## Setting Up Binance TestNet

1. **Create a Binance TestNet Account**:
   - Go to [Binance TestNet](https://testnet.binance.vision/)
   - Register for an account
   - Generate API keys with appropriate permissions

2. **Configure Your Environment**:
   - Open the `.env` file in your project
   - Update the following variables with your TestNet credentials:
     ```
     BINANCE_TESTNET_API_KEY=your_testnet_api_key
     BINANCE_TESTNET_SECRET=your_testnet_secret
     ```

3. **Start the Application in Demo Mode**:
   - The application will automatically use TestNet for trading when in demo mode
   - All trades will be executed on the TestNet exchange

## How It Works

When a strategy is activated in demo mode:

1. The application connects to Binance TestNet using your API credentials
2. Real market data is fetched from TestNet
3. When a trade signal is generated, a real trade is executed on TestNet
4. The trade is tracked and updated in real-time
5. All profits and losses are simulated using TestNet balances

## Troubleshooting

If you encounter issues with TestNet:

1. **API Key Issues**:
   - Ensure your TestNet API keys have the correct permissions
   - Regenerate keys if necessary

2. **Connection Problems**:
   - Check that the TestNet is operational (sometimes it goes down for maintenance)
   - Verify your internet connection

3. **Balance Issues**:
   - TestNet accounts start with a limited balance
   - You can request more test funds through the TestNet website

## Benefits of Using TestNet

- Real exchange behavior without financial risk
- Accurate order execution and matching
- Real market data and conditions
- Practice with the actual trading interface

By using TestNet instead of simulated trades, you get a much more realistic trading experience that better prepares you for live trading.

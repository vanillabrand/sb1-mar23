#!/bin/bash

# Make the script executable
chmod +x deploy.sh

echo "=== Starting Trading Engine Deployment ==="

# Step 1: Create necessary directories
echo "Creating directory structure..."
mkdir -p backend/python

# Step 2: Copy the Python trading engine code to backend/python/app.py
echo "Setting up Python backend..."
cat > backend/python/app.py << 'EOL'
import os
import asyncio
import logging
import json
import uuid
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client, Client
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("trading_engine.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("trading_engine")

# Initialize FastAPI app
app = FastAPI(title="Trading Engine API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# Deepseek API configuration
DEEPSEEK_API_URL = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com/v1/chat/completions")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")

# Exchange configuration
BINANCE_API_KEY = os.getenv("BINANCE_API_KEY", "")
BINANCE_API_SECRET = os.getenv("BINANCE_API_SECRET", "")
BINANCE_TESTNET_API_KEY = os.getenv("BINANCE_TESTNET_API_KEY")
BINANCE_TESTNET_API_SECRET = os.getenv("BINANCE_TESTNET_API_SECRET")

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        if client_id not in self.active_connections:
            self.active_connections[client_id] = []
        self.active_connections[client_id].append(websocket)
        logger.info(f"Client {client_id} connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket, client_id: str):
        if client_id in self.active_connections:
            if websocket in self.active_connections[client_id]:
                self.active_connections[client_id].remove(websocket)
            if not self.active_connections[client_id]:
                del self.active_connections[client_id]
        logger.info(f"Client {client_id} disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast_to_client(self, client_id: str, message: dict):
        if client_id in self.active_connections:
            for connection in self.active_connections[client_id]:
                await connection.send_json(message)

    async def broadcast_to_all(self, message: dict):
        for client_id in self.active_connections:
            await self.broadcast_to_client(client_id, message)

manager = ConnectionManager()

# Data models
class Strategy(BaseModel):
    id: str
    title: str
    description: str
    status: str
    riskLevel: str
    market_type: str = "spot"  # Default to spot trading
    selected_pairs: List[str]
    entry_conditions: Optional[Dict[str, Any]] = None
    exit_conditions: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    user_id: str

class Trade(BaseModel):
    id: str
    strategy_id: str
    symbol: str
    side: str
    status: str
    amount: float
    entry_price: Optional[float] = None
    exit_price: Optional[float] = None
    profit: Optional[float] = None
    timestamp: int
    created_at: datetime
    executed_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    order_id: Optional[str] = None  # Exchange order ID for live trading

class StrategyBudget(BaseModel):
    total: float
    allocated: float
    available: float
    max_position_size: float
    last_updated: int

class MarketData(BaseModel):
    symbol: str
    price: float
    bid: float
    ask: float
    volume: float
    timestamp: float
    high_24h: Optional[float] = None
    low_24h: Optional[float] = None
    change_24h: Optional[float] = None

class EngineConfig(BaseModel):
    demo_mode: bool = True
    check_interval: int = 60  # seconds
    max_trades_per_strategy: int = 9999999  # Unlimited trades per strategy
    max_open_trades_total: int = 9999999  # Unlimited total trades
    risk_per_trade: float = 0.02  # 2% of account per trade
    default_stop_loss: float = 0.01  # 1% stop loss
    default_take_profit: float = 0.02  # 2% take profit
    exchange: str = "binance"

# Exchange interface
class ExchangeInterface:
    def __init__(self, exchange_id: str, demo_mode: bool = True):
        self.exchange_id = exchange_id
        self.demo_mode = demo_mode
        self.exchange = None
        self.market_cache = {}
        self.last_market_update = datetime.now() - timedelta(minutes=10)

    async def initialize(self):
        """Initialize the exchange connection"""
        try:
            # In a real implementation, we would initialize the CCXT exchange here
            # For now, we'll just simulate it
            logger.info(f"Initialized {self.exchange_id} in {'demo' if self.demo_mode else 'live'} mode")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize exchange {self.exchange_id}: {str(e)}")
            return False

    async def close(self):
        """Close the exchange connection"""
        logger.info(f"Closed connection to {self.exchange_id}")

    async def get_market_data(self, symbol: str) -> MarketData:
        """Get market data for a symbol"""
        try:
            # Generate synthetic data
            return self._generate_synthetic_market_data(symbol)
        except Exception as e:
            logger.error(f"Error getting market data for {symbol}: {str(e)}")
            return self._generate_synthetic_market_data(symbol)

    def _generate_synthetic_market_data(self, symbol: str) -> MarketData:
        """Generate synthetic market data for demo mode or fallback"""
        # Base price depends on the symbol
        base_price = 0
        if "BTC" in symbol:
            base_price = 45000 + (random.random() * 1000)
        elif "ETH" in symbol:
            base_price = 3000 + (random.random() * 100)
        elif "SOL" in symbol:
            base_price = 100 + (random.random() * 10)
        elif "BNB" in symbol:
            base_price = 300 + (random.random() * 20)
        else:
            base_price = 50 + (random.random() * 5)

        # Add some random variation
        price = base_price * (1 + (0.01 * (0.5 - random.random())))

        market_data = MarketData(
            symbol=symbol,
            price=price,
            bid=price * 0.999,
            ask=price * 1.001,
            volume=price * 1000 * random.random(),
            timestamp=datetime.now().timestamp(),
            high_24h=price * 1.02,
            low_24h=price * 0.98,
            change_24h=(random.random() * 4) - 2  # -2% to +2%
        )

        # Cache the synthetic data
        self.market_cache[symbol] = {
            "price": market_data.price,
            "volume": market_data.volume,
            "high_24h": market_data.high_24h,
            "low_24h": market_data.low_24h,
            "change_24h": market_data.change_24h
        }

        return market_data

    async def create_order(self, symbol: str, order_type: str, side: str, amount: float, price: Optional[float] = None) -> dict:
        """Create an order on the exchange"""
        try:
            # Simulate order creation in demo mode
            order_id = f"demo-{uuid.uuid4()}"
            market_data = await self.get_market_data(symbol)

            executed_price = price if price else market_data.price

            # Simulate some slippage
            if side == "buy":
                executed_price *= 1.001  # 0.1% higher for buys
            else:
                executed_price *= 0.999  # 0.1% lower for sells

            order = {
                "id": order_id,
                "symbol": symbol,
                "type": order_type,
                "side": side,
                "amount": amount,
                "price": executed_price,
                "cost": amount * executed_price,
                "status": "closed",  # Assume immediate execution in demo mode
                "timestamp": datetime.now().timestamp() * 1000,
                "datetime": datetime.now().isoformat(),
                "fee": {
                    "cost": amount * executed_price * 0.001,  # 0.1% fee
                    "currency": symbol.split('/')[1] if '/' in symbol else symbol.split('_')[1]
                }
            }

            logger.info(f"Created demo order: {order}")
            return order
        except Exception as e:
            logger.error(f"Error creating order for {symbol}: {str(e)}")
            raise

    async def get_order(self, symbol: str, order_id: str) -> dict:
        """Get order details from the exchange"""
        try:
            # Return simulated order for demo mode
            return {
                "id": order_id,
                "symbol": symbol,
                "status": "closed",
                "filled": 1.0,  # Assume fully filled
                "remaining": 0.0
            }
        except Exception as e:
            logger.error(f"Error getting order {order_id} for {symbol}: {str(e)}")
            raise

    async def cancel_order(self, symbol: str, order_id: str) -> dict:
        """Cancel an order on the exchange"""
        try:
            # Simulate order cancellation in demo mode
            return {
                "id": order_id,
                "symbol": symbol,
                "status": "canceled"
            }
        except Exception as e:
            logger.error(f"Error canceling order {order_id} for {symbol}: {str(e)}")
            raise

    async def get_balance(self) -> dict:
        """Get account balance from the exchange"""
        try:
            # Return simulated balance for demo mode
            return {
                "total": {
                    "USDT": 10000.0,
                    "BTC": 0.1,
                    "ETH": 1.0,
                    "SOL": 10.0,
                    "BNB": 5.0
                },
                "free": {
                    "USDT": 8000.0,
                    "BTC": 0.08,
                    "ETH": 0.8,
                    "SOL": 8.0,
                    "BNB": 4.0
                },
                "used": {
                    "USDT": 2000.0,
                    "BTC": 0.02,
                    "ETH": 0.2,
                    "SOL": 2.0,
                    "BNB": 1.0
                }
            }
        except Exception as e:
            logger.error(f"Error getting balance: {str(e)}")
            raise

# Trading Engine
class TradingEngine:
    def __init__(self):
        self.active_strategies: Dict[str, Strategy] = {}
        self.strategy_budgets: Dict[str, StrategyBudget] = {}
        self.is_running = False
        self.config = EngineConfig()
        self.exchange_interface = None
        self.market_data_cache: Dict[str, MarketData] = {}
        self.last_market_update = datetime.now() - timedelta(minutes=10)

    async def initialize(self, config: Optional[EngineConfig] = None):
        """Initialize the trading engine with configuration"""
        if config:
            self.config = config

        # Initialize exchange interface
        self.exchange_interface = ExchangeInterface(
            exchange_id=self.config.exchange,
            demo_mode=self.config.demo_mode
        )

        success = await self.exchange_interface.initialize()
        if not success:
            logger.error("Failed to initialize exchange interface")
            return False

        logger.info(f"Trading Engine initialized in {'demo' if self.config.demo_mode else 'live'} mode")
        return True

    async def start(self):
        """Start the trading engine"""
        if self.is_running:
            return

        if not self.exchange_interface:
            success = await self.initialize()
            if not success:
                logger.error("Failed to initialize trading engine")
                return

        self.is_running = True
        logger.info(f"Trading Engine started in {'demo' if self.config.demo_mode else 'live'} mode")

        # Load active strategies from database
        await self.load_active_strategies()

        # Start the main loop
        asyncio.create_task(self.run_engine_loop())

    async def stop(self):
        """Stop the trading engine"""
        self.is_running = False

        # Close exchange connection
        if self.exchange_interface:
            await self.exchange_interface.close()

        logger.info("Trading Engine stopped")

    async def load_active_strategies(self):
        """Load active strategies from the database"""
        try:
            response = supabase.table("strategies").select("*").eq("status", "active").execute()

            if response.data:
                for strategy_data in response.data:
                    strategy = Strategy(**strategy_data)
                    self.active_strategies[strategy.id] = strategy

                    # Load budget for this strategy
                    await self.load_strategy_budget(strategy.id)

            logger.info(f"Loaded {len(self.active_strategies)} active strategies")
        except Exception as e:
            logger.error(f"Error loading active strategies: {str(e)}")

    async def load_strategy_budget(self, strategy_id: str):
        """Load budget for a strategy from the database"""
        try:
            response = supabase.table("strategy_budgets").select("*").eq("strategy_id", strategy_id).execute()

            if response.data and len(response.data) > 0:
                budget_data = response.data[0]
                self.strategy_budgets[strategy_id] = StrategyBudget(
                    total=budget_data["total"],
                    allocated=budget_data["allocated"],
                    available=budget_data["available"],
                    max_position_size=budget_data["max_position_size"],
                    last_updated=budget_data["last_updated"]
                )
            else:
                # Create default budget if none exists
                default_budget = StrategyBudget(
                    total=1000.0,
                    allocated=0.0,
                    available=1000.0,
                    max_position_size=200.0,
                    last_updated=int(datetime.now().timestamp() * 1000)
                )
                self.strategy_budgets[strategy_id] = default_budget

                # Save to database
                supabase.table("strategy_budgets").insert({
                    "strategy_id": strategy_id,
                    "total": default_budget.total,
                    "allocated": default_budget.allocated,
                    "available": default_budget.available,
                    "max_position_size": default_budget.max_position_size,
                    "last_updated": default_budget.last_updated
                }).execute()

        except Exception as e:
            logger.error(f"Error loading budget for strategy {strategy_id}: {str(e)}")

    async def update_market_data(self):
        """Update market data for all symbols used by active strategies"""
        if (datetime.now() - self.last_market_update).total_seconds() < 60:
            return  # Only update every minute

        symbols = set()
        for strategy in self.active_strategies.values():
            if strategy.selected_pairs:
                symbols.update(strategy.selected_pairs)

        if not symbols:
            return

        try:
            for symbol in symbols:
                try:
                    market_data = await self.exchange_interface.get_market_data(symbol)
                    self.market_data_cache[symbol] = market_data
                except Exception as symbol_error:
                    logger.error(f"Error updating market data for {symbol}: {str(symbol_error)}")

            self.last_market_update = datetime.now()
            logger.info(f"Updated market data for {len(symbols)} symbols")
        except Exception as e:
            logger.error(f"Error updating market data: {str(e)}")

    async def generate_trades_with_deepseek(self, strategy: Strategy, budget: StrategyBudget):
        """Generate trades using Deepseek AI based on strategy and market data"""
        try:
            # Prepare market data for the selected pairs
            market_snapshot = {}
            for pair in strategy.selected_pairs:
                if pair in self.market_data_cache:
                    market_data = self.market_data_cache[pair]
                    market_snapshot[pair] = {
                        "price": market_data.price,
                        "bid": market_data.bid,
                        "ask": market_data.ask,
                        "volume": market_data.volume,
                        "high_24h": market_data.high_24h,
                        "low_24h": market_data.low_24h,
                        "change_24h": market_data.change_24h,
                        "timestamp": market_data.timestamp
                    }

            if not market_snapshot:
                logger.warning(f"No market data available for strategy {strategy.id}")
                return []

            # Get current account balance
            account_balance = await self.exchange_interface.get_balance()

            # Prepare the prompt for Deepseek
            prompt = f"""
            You are an expert trading algorithm. Generate trades based on the following information:

            Strategy Details:
            - Title: {strategy.title}
            - Description: {strategy.description}
            - Risk Level: {strategy.riskLevel}
            - Market Type: {strategy.market_type}

            Available Budget: ${budget.available}
            Maximum Position Size: ${budget.max_position_size}
            Trading Mode: {"Demo" if self.config.demo_mode else "Live"}

            Current Market Data:
            {json.dumps(market_snapshot, indent=2)}

            Account Balance:
            {json.dumps(account_balance["free"], indent=2)}

            Based on this information, generate between 1-3 trades. For each trade, provide:
            1. Symbol (must be one of the strategy's selected pairs)
            2. Side (buy or sell)
            3. Amount (in USD, must be <= max position size)
            4. Entry price (optional, can use market price)
            5. Order type (market or limit)
            6. Stop loss percentage (optional)
            7. Take profit percentage (optional)

            Return the trades in a structured JSON format like this:
            {{
                "trades": [
                    {{
                        "symbol": "BTC/USDT",
                        "side": "buy",
                        "amount": 100.0,
                        "entry_price": 45000.0,
                        "order_type": "limit",
                        "stop_loss_pct": 0.01,
                        "take_profit_pct": 0.02
                    }}
                ]
            }}

            Only include trades that make sense given the current market conditions and strategy risk level.
            If no trades are appropriate, return an empty array.
            """

            # Call Deepseek API
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    DEEPSEEK_API_URL,
                    headers={
                        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "deepseek-chat",
                        "messages": [
                            {"role": "system", "content": "You are a trading algorithm assistant that generates trades based on market data and strategy parameters."},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.7,
                        "max_tokens": 1000
                    },
                    timeout=30.0
                )

                if response.status_code != 200:
                    logger.error(f"Deepseek API error: {response.text}")
                    return []

                result = response.json()
                ai_response = result["choices"][0]["message"]["content"]

                # Parse the AI response to extract trades
                import json
                import re

                # Try to find JSON in the response
                json_match = re.search(r'```json\n(.*?)\n```', ai_response, re.DOTALL)
                if json_match:
                    json_str = json_match.group(1)
                else:
                    # Try to find any JSON-like structure
                    json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
                    if json_match:
                        json_str = json_match.group(0)
                    else:
                        logger.error(f"Could not parse trades from Deepseek response: {ai_response}")
                        return []

                try:
                    trades_data = json.loads(json_str)

                    # Process the trades
                    generated_trades = []
                    if isinstance(trades_data, dict) and "trades" in trades_data:
                        trades_list = trades_data["trades"]
                    elif isinstance(trades_data, list):
                        trades_list = trades_data
                    else:
                        trades_list = [trades_data]

                    for trade_data in trades_list:
                        # Validate the trade data
                        if "symbol" not in trade_data or trade_data["symbol"] not in strategy.selected_pairs:
                            continue

                        if "side" not in trade_data or trade_data["side"].lower() not in ["buy", "sell"]:
                            continue

                        if "amount" not in trade_data or not isinstance(trade_data["amount"], (int, float)):
                            continue

                        # Ensure amount is within limits
                        amount = min(float(trade_data["amount"]), budget.max_position_size)
                        amount = min(amount, budget.available)

                        if amount <= 0:
                            continue

                        # Get entry price
                        entry_price = None
                        if "entry_price" in trade_data and isinstance(trade_data["entry_price"], (int, float)):
                            entry_price = float(trade_data["entry_price"])
                        elif trade_data["symbol"] in self.market_data_cache:
                            entry_price = self.market_data_cache[trade_data["symbol"]].price

                        if not entry_price:
                            continue

                        # Get order type
                        order_type = "market"
                        if "order_type" in trade_data and trade_data["order_type"] in ["market", "limit"]:
                            order_type = trade_data["order_type"]

                        # Get stop loss and take profit percentages
                        stop_loss_pct = self.config.default_stop_loss
                        if "stop_loss_pct" in trade_data and isinstance(trade_data["stop_loss_pct"], (int, float)):
                            stop_loss_pct = float(trade_data["stop_loss_pct"])

                        take_profit_pct = self.config.default_take_profit
                        if "take_profit_pct" in trade_data and isinstance(trade_data["take_profit_pct"], (int, float)):
                            take_profit_pct = float(trade_data["take_profit_pct"])

                        # Create trade object
                        trade_id = str(uuid.uuid4())
                        now = datetime.now()

                        trade = {
                            "id": trade_id,
                            "strategy_id": strategy.id,
                            "symbol": trade_data["symbol"],
                            "side": trade_data["side"].lower(),
                            "status": "pending",
                            "amount": amount,
                            "entry_price": entry_price,
                            "exit_price": None,
                            "profit": None,
                            "timestamp": int(now.timestamp() * 1000),
                            "created_at": now.isoformat(),
                            "executed_at": None,
                            "closed_at": None,
                            "order_id": None,
                            "order_type": order_type,
                            "stop_loss_pct": stop_loss_pct,
                            "take_profit_pct": take_profit_pct
                        }

                        generated_trades.append(trade)

                    return generated_trades

                except json.JSONDecodeError:
                    logger.error(f"Failed to parse JSON from Deepseek response: {ai_response}")
                    return []

        except Exception as e:
            logger.error(f"Error generating trades with Deepseek: {str(e)}")
            return []

    async def save_trade(self, trade: dict):
        """Save a trade to the database"""
        try:
            # Remove fields that aren't in the database schema
            db_trade = trade.copy()
            if "order_type" in db_trade:
                del db_trade["order_type"]
            if "stop_loss_pct" in db_trade:
                del db_trade["stop_loss_pct"]
            if "take_profit_pct" in db_trade:
                del db_trade["take_profit_pct"]

            response = supabase.table("trades").insert(db_trade).execute()
            logger.info(f"Saved trade {trade['id']} to database")
            return response.data
        except Exception as e:
            logger.error(f"Error saving trade to database: {str(e)}")
            return None

    async def update_trade(self, trade_id: str, updates: dict):
        """Update a trade in the database"""
        try:
            response = supabase.table("trades").update(updates).eq("id", trade_id).execute()
            logger.info(f"Updated trade {trade_id} in database")
            return response.data
        except Exception as e:
            logger.error(f"Error updating trade {trade_id} in database: {str(e)}")
            return None

    async def update_budget(self, strategy_id: str, allocated_amount: float):
        """Update the budget for a strategy after allocating funds to a trade"""
        if strategy_id not in self.strategy_budgets:
            return

        budget = self.strategy_budgets[strategy_id]
        budget.allocated += allocated_amount
        budget.available = budget.total - budget.allocated
        budget.last_updated = int(datetime.now().timestamp() * 1000)

        try:
            supabase.table("strategy_budgets").update({
                "allocated": budget.allocated,
                "available": budget.available,
                "last_updated": budget.last_updated
            }).eq("strategy_id", strategy_id).execute()

            logger.info(f"Updated budget for strategy {strategy_id}: allocated=${budget.allocated:.2f}, available=${budget.available:.2f}")
        except Exception as e:
            logger.error(f"Error updating budget for strategy {strategy_id}: {str(e)}")

    async def check_strategy_for_trades(self, strategy_id: str):
        """Check if a strategy should generate trades"""
        if strategy_id not in self.active_strategies or strategy_id not in self.strategy_budgets:
            return

        strategy = self.active_strategies[strategy_id]
        budget = self.strategy_budgets[strategy_id]

        # Check if there's enough available budget
        if budget.available < 10:  # Minimum $10 available
            logger.info(f"Strategy {strategy_id} has insufficient budget: ${budget.available:.2f}")
            return

        # Get active trades for this strategy (for logging purposes only)
        try:
            response = supabase.table("trades").select("*").eq("strategy_id", strategy_id).in_("status", ["pending", "executed"]).execute()
            active_trades = response.data

            # Log the number of active trades - no limit on number of trades
            logger.info(f"Strategy {strategy_id} has {len(active_trades)} active trades (unlimited trades allowed)")

            # Generate trades with Deepseek
            generated_trades = await self.generate_trades_with_deepseek(strategy, budget)

            if not generated_trades:
                logger.info(f"No trades generated for strategy {strategy_id}")
                return

            # Save trades to database and update budget
            for trade in generated_trades:
                await self.save_trade(trade)
                await self.update_budget(strategy_id, trade["amount"])

            # Notify connected clients
            await manager.broadcast_to_all({
                "type": "trades_generated",
                "strategy_id": strategy_id,
                "trades": generated_trades
            })

            logger.info(f"Generated {len(generated_trades)} trades for strategy {strategy_id}")

        except Exception as e:
            logger.error(f"Error checking strategy {strategy_id} for trades: {str(e)}")

    async def execute_pending_trades(self):
        """Execute pending trades"""
        try:
            response = supabase.table("trades").select("*").eq("status", "pending").execute()
            pending_trades = response.data

            if not pending_trades:
                return

            logger.info(f"Executing {len(pending_trades)} pending trades")

            for trade in pending_trades:
                try:
                    # Get trade details
                    symbol = trade["symbol"]
                    side = trade["side"]
                    amount = trade["amount"]
                    entry_price = trade["entry_price"]

                    # Get order type (may not be in database)
                    order_type = "market"
                    if "order_type" in trade:
                        order_type = trade["order_type"]

                    # Create order on exchange
                    order = await self.exchange_interface.create_order(
                        symbol=symbol,
                        order_type=order_type,
                        side=side,
                        amount=amount,
                        price=entry_price if order_type == "limit" else None
                    )

                    # Update trade in database
                    executed_at = datetime.now()
                    updates = {
                        "status": "executed",
                        "executed_at": executed_at.isoformat(),
                        "order_id": order["id"]
                    }

                    # If market order, update entry price with actual execution price
                    if order_type == "market" and "price" in order:
                        updates["entry_price"] = order["price"]

                    await self.update_trade(trade["id"], updates)

                    # Notify connected clients
                    await manager.broadcast_to_all({
                        "type": "trade_executed",
                        "trade_id": trade["id"],
                        "strategy_id": trade["strategy_id"],
                        "executed_at": executed_at.isoformat(),
                        "order_id": order["id"]
                    })

                    logger.info(f"Executed trade {trade['id']} for strategy {trade['strategy_id']}")

                except Exception as trade_error:
                    logger.error(f"Error executing trade {trade['id']}: {str(trade_error)}")

                    # Mark trade as failed
                    await self.update_trade(trade["id"], {
                        "status": "failed",
                        "notes": f"Execution failed: {str(trade_error)}"
                    })

                    # Return allocated budget
                    await self.update_budget(trade["strategy_id"], -trade["amount"])

        except Exception as e:
            logger.error(f"Error executing pending trades: {str(e)}")

    async def check_active_trades(self):
        """Check active trades for exit conditions"""
        try:
            response = supabase.table("trades").select("*").eq("status", "executed").execute()
            active_trades = response.data

            if not active_trades:
                return

            logger.info(f"Checking {len(active_trades)} active trades for exit conditions")

            for trade in active_trades:
                try:
                    # Skip trades that don't have market data
                    if trade["symbol"] not in self.market_data_cache:
                        continue

                    current_price = self.market_data_cache[trade["symbol"]].price
                    entry_price = trade["entry_price"]

                    # Get stop loss and take profit percentages
                    stop_loss_pct = self.config.default_stop_loss
                    take_profit_pct = self.config.default_take_profit

                    # Check if trade has custom stop loss/take profit
                    if "stop_loss_pct" in trade and trade["stop_loss_pct"]:
                        stop_loss_pct = trade["stop_loss_pct"]

                    if "take_profit_pct" in trade and trade["take_profit_pct"]:
                        take_profit_pct = trade["take_profit_pct"]

                    # Calculate exit prices
                    if trade["side"] == "buy":
                        stop_loss_price = entry_price * (1 - stop_loss_pct)
                        take_profit_price = entry_price * (1 + take_profit_pct)

                        should_exit = current_price <= stop_loss_price or current_price >= take_profit_price
                        exit_reason = "stop_loss" if current_price <= stop_loss_price else "take_profit"
                        profit_pct = (current_price - entry_price) / entry_price
                    else:  # sell
                        stop_loss_price = entry_price * (1 + stop_loss_pct)
                        take_profit_price = entry_price * (1 - take_profit_pct)

                        should_exit = current_price >= stop_loss_price or current_price <= take_profit_price
                        exit_reason = "stop_loss" if current_price >= stop_loss_price else "take_profit"
                        profit_pct = (entry_price - current_price) / entry_price

                    if should_exit:
                        # Close the position
                        exit_price = current_price
                        profit = profit_pct * trade["amount"]
                        closed_at = datetime.now()

                        # If in live mode, create a closing order
                        if not self.config.demo_mode and trade["order_id"]:
                            # Create opposite order to close the position
                            close_side = "sell" if trade["side"] == "buy" else "buy"

                            close_order = await self.exchange_interface.create_order(
                                symbol=trade["symbol"],
                                order_type="market",
                                side=close_side,
                                amount=trade["amount"]
                            )

                            # Use actual execution price
                            if "price" in close_order:
                                exit_price = close_order["price"]
                                # Recalculate profit
                                if trade["side"] == "buy":
                                    profit_pct = (exit_price - entry_price) / entry_price
                                else:
                                    profit_pct = (entry_price - exit_price) / entry_price
                                profit = profit_pct * trade["amount"]

                        # Update trade in database
                        await self.update_trade(trade["id"], {
                            "status": "closed",
                            "exit_price": exit_price,
                            "profit": profit,
                            "closed_at": closed_at.isoformat(),
                            "notes": f"Closed due to {exit_reason}"
                        })

                        # Update strategy budget
                        strategy_id = trade["strategy_id"]
                        if strategy_id in self.strategy_budgets:
                            budget = self.strategy_budgets[strategy_id]
                            budget.allocated -= trade["amount"]
                            budget.available = budget.total - budget.allocated

                            # Add profit/loss to total budget
                            budget.total += profit
                            budget.available += profit + trade["amount"]  # Return allocated amount plus profit

                            budget.last_updated = int(datetime.now().timestamp() * 1000)

                            # Update budget in database
                            supabase.table("strategy_budgets").update({
                                "total": budget.total,
                                "allocated": budget.allocated,
                                "available": budget.available,
                                "last_updated": budget.last_updated
                            }).eq("strategy_id", strategy_id).execute()

                        # Notify connected clients
                        await manager.broadcast_to_all({
                            "type": "trade_closed",
                            "trade_id": trade["id"],
                            "strategy_id": strategy_id,
                            "exit_price": exit_price,
                            "profit": profit,
                            "closed_at": closed_at.isoformat(),
                            "exit_reason": exit_reason
                        })

                        logger.info(f"Closed trade {trade['id']} with profit ${profit:.2f} ({profit_pct:.2%}) due to {exit_reason}")

                except Exception as trade_error:
                    logger.error(f"Error checking trade {trade['id']}: {str(trade_error)}")

        except Exception as e:
            logger.error(f"Error checking active trades: {str(e)}")

    async def check_strategy_status(self):
        """Check if any strategies have been activated or deactivated"""
        try:
            # Check for newly activated strategies
            response = supabase.table("strategies").select("*").eq("status", "active").execute()
            active_strategies_data = response.data

            # Add new active strategies
            for strategy_data in active_strategies_data:
                strategy_id = strategy_data["id"]
                if strategy_id not in self.active_strategies:
                    strategy = Strategy(**strategy_data)
                    self.active_strategies[strategy_id] = strategy
                    await self.load_strategy_budget(strategy_id)
                    logger.info(f"Added new active strategy: {strategy_id}")

            # Remove deactivated strategies
            current_active_ids = [s["id"] for s in active_strategies_data]
            to_remove = [sid for sid in self.active_strategies.keys() if sid not in current_active_ids]

            for strategy_id in to_remove:
                del self.active_strategies[strategy_id]
                if strategy_id in self.strategy_budgets:
                    del self.strategy_budgets[strategy_id]
                logger.info(f"Removed deactivated strategy: {strategy_id}")

        except Exception as e:
            logger.error(f"Error checking strategy status: {str(e)}")

       async def run_engine_loop(self):
        """Main engine loop"""
        while self.is_running:
            try:
                # Update market data
                await self.update_market_data()

                # Check strategy status
                await self.check_strategy_status()

                # Execute pending trades
                await self.execute_pending_trades()

                # Check active trades for exit conditions
                await self.check_active_trades()

                # Check each active strategy for new trade opportunities
                for strategy_id in list(self.active_strategies.keys()):
                    await self.check_strategy_for_trades(strategy_id)

                # Wait for next cycle
                await asyncio.sleep(self.config.check_interval)

            except Exception as e:
                logger.error(f"Error in engine loop: {str(e)}")
                await asyncio.sleep(10)  # Wait a bit before retrying

# Initialize trading engine
trading_engine = TradingEngine()

# API endpoints
@app.get("/")
async def root():
    return {"message": "Trading Engine API"}

@app.get("/status")
async def get_status():
    return {
        "is_running": trading_engine.is_running,
        "demo_mode": trading_engine.config.demo_mode,
        "active_strategies": len(trading_engine.active_strategies),
        "last_market_update": trading_engine.last_market_update.isoformat() if trading_engine.last_market_update else None
    }

@app.post("/start")
async def start_engine(background_tasks: BackgroundTasks):
    if not trading_engine.is_running:
        background_tasks.add_task(trading_engine.start)
        return {"message": "Trading engine starting", "status": "starting"}
    return {"message": "Trading engine already running", "status": "running"}

@app.post("/stop")
async def stop_engine(background_tasks: BackgroundTasks):
    if trading_engine.is_running:
        background_tasks.add_task(trading_engine.stop)
        return {"message": "Trading engine stopping", "status": "stopping"}
    return {"message": "Trading engine already stopped", "status": "stopped"}

@app.post("/config")
async def update_config(config: EngineConfig):
    # Stop engine if running
    was_running = trading_engine.is_running
    if was_running:
        await trading_engine.stop()

    # Update config
    trading_engine.config = config

    # Restart if it was running
    if was_running:
        await trading_engine.initialize(config)
        await trading_engine.start()

    return {"message": "Trading engine configuration updated", "config": config.dict()}

@app.get("/config")
async def get_config():
    return {"config": trading_engine.config}

@app.get("/strategies")
async def get_strategies():
    return {"strategies": list(trading_engine.active_strategies.values())}

@app.get("/strategies/{strategy_id}")
async def get_strategy(strategy_id: str):
    if strategy_id not in trading_engine.active_strategies:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return {"strategy": trading_engine.active_strategies[strategy_id]}

@app.get("/strategies/{strategy_id}/budget")
async def get_strategy_budget(strategy_id: str):
    if strategy_id not in trading_engine.strategy_budgets:
        raise HTTPException(status_code=404, detail="Strategy budget not found")
    return {"budget": trading_engine.strategy_budgets[strategy_id]}

@app.get("/strategies/{strategy_id}/trades")
async def get_strategy_trades(strategy_id: str, status: Optional[str] = None):
    try:
        query = supabase.table("trades").select("*").eq("strategy_id", strategy_id)

        if status:
            # Filter by status if provided
            if status == "active":
                query = query.in_("status", ["pending", "executed"])
            else:
                query = query.eq("status", status)

        response = query.order("created_at", {"ascending": False}).execute()
        return {"trades": response.data}
    except Exception as e:
        logger.error(f"Error getting trades for strategy {strategy_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/strategies/{strategy_id}/activate")
async def activate_strategy(strategy_id: str, budget: float):
    try:
        # Update strategy status in database
        supabase.table("strategies").update({"status": "active"}).eq("id", strategy_id).execute()

        # Create or update budget
        budget_data = {
            "strategy_id": strategy_id,
            "total": budget,
            "allocated": 0,
            "available": budget,
            "max_position_size": budget * 0.2,  # 20% of total budget
            "last_updated": int(datetime.now().timestamp() * 1000)
        }

        # Check if budget already exists
        response = supabase.table("strategy_budgets").select("*").eq("strategy_id", strategy_id).execute()
        if response.data and len(response.data) > 0:
            supabase.table("strategy_budgets").update(budget_data).eq("strategy_id", strategy_id).execute()
        else:
            supabase.table("strategy_budgets").insert(budget_data).execute()

        # Refresh engine data
        await trading_engine.check_strategy_status()

        return {"message": f"Strategy {strategy_id} activated with budget ${budget}"}
    except Exception as e:
        logger.error(f"Error activating strategy {strategy_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/strategies/{strategy_id}/deactivate")
async def deactivate_strategy(strategy_id: str, close_trades: bool = True):
    try:
        # Update strategy status in database
        supabase.table("strategies").update({"status": "inactive"}).eq("id", strategy_id).execute()

        # Close any active trades if requested
        if close_trades:
            response = supabase.table("trades").select("*").eq("strategy_id", strategy_id).in_("status", ["pending", "executed"]).execute()
            active_trades = response.data

            for trade in active_trades:
                try:
                    # If in live mode and trade has an order ID, cancel the order
                    if not trading_engine.config.demo_mode and trade["status"] == "pending" and trade.get("order_id"):
                        await trading_engine.exchange_interface.cancel_order(trade["symbol"], trade["order_id"])

                    # If trade is executed, create a closing order
                    if not trading_engine.config.demo_mode and trade["status"] == "executed" and trade.get("order_id"):
                        close_side = "sell" if trade["side"] == "buy" else "buy"

                        close_order = await trading_engine.exchange_interface.create_order(
                            symbol=trade["symbol"],
                            order_type="market",
                            side=close_side,
                            amount=trade["amount"]
                        )

                        # Use actual execution price
                        exit_price = trade["entry_price"]  # Default to entry price
                        if "price" in close_order:
                            exit_price = close_order["price"]

                        # Calculate profit
                        profit = 0
                        if trade["side"] == "buy":
                            profit = (exit_price - trade["entry_price"]) * trade["amount"] / trade["entry_price"]
                        else:
                            profit = (trade["entry_price"] - exit_price) * trade["amount"] / trade["entry_price"]

                        # Update trade
                        supabase.table("trades").update({
                            "status": "closed",
                            "closed_at": datetime.now().isoformat(),
                            "exit_price": exit_price,
                            "profit": profit,
                            "notes": "Closed due to strategy deactivation"
                        }).eq("id", trade["id"]).execute()
                    else:
                        # For demo mode or pending trades, just mark as closed
                        supabase.table("trades").update({
                            "status": "closed",
                            "closed_at": datetime.now().isoformat(),
                            "exit_price": trade["entry_price"],  # Assume exit at entry price
                            "profit": 0,
                            "notes": "Closed due to strategy deactivation"
                        }).eq("id", trade["id"]).execute()

                except Exception as trade_error:
                    logger.error(f"Error closing trade {trade['id']}: {str(trade_error)}")

                    # Mark as closed anyway
                    supabase.table("trades").update({
                        "status": "closed",
                        "closed_at": datetime.now().isoformat(),
                        "notes": f"Failed to close properly: {str(trade_error)}"
                    }).eq("id", trade["id"]).execute()

        # Refresh engine data
        await trading_engine.check_strategy_status()

        return {"message": f"Strategy {strategy_id} deactivated and {len(active_trades) if close_trades else 0} trades closed"}
    except Exception as e:
        logger.error(f"Error deactivating strategy {strategy_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/demo-mode")
async def set_demo_mode(demo_mode: bool = True):
    """Set the trading engine to demo or live mode"""
    # Stop engine if running
    was_running = trading_engine.is_running
    if was_running:
        await trading_engine.stop()

    # Update config
    trading_engine.config.demo_mode = demo_mode

    # Restart if it was running
    if was_running:
        await trading_engine.initialize()
        await trading_engine.start()

    return {"message": f"Trading engine set to {'demo' if demo_mode else 'live'} mode"}

@app.get("/market-data")
async def get_market_data(symbol: Optional[str] = None):
    """Get market data for a specific symbol or all cached symbols"""
    if not trading_engine.exchange_interface:
        await trading_engine.initialize()

    if symbol:
        try:
            market_data = await trading_engine.exchange_interface.get_market_data(symbol)
            return {"market_data": market_data}
        except Exception as e:
            logger.error(f"Error getting market data for {symbol}: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    else:
        return {"market_data": trading_engine.market_data_cache}

@app.get("/balance")
async def get_balance():
    """Get account balance from the exchange"""
    if not trading_engine.exchange_interface:
        await trading_engine.initialize()

    try:
        balance = await trading_engine.exchange_interface.get_balance()
        return {"balance": balance}
    except Exception as e:
        logger.error(f"Error getting balance: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# WebSocket endpoint for real-time updates
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            # Wait for messages from the client
            data = await websocket.receive_text()

            try:
                message = json.loads(data)

                # Handle different message types
                if "type" in message:
                    if message["type"] == "ping":
                        await websocket.send_json({"type": "pong", "timestamp": datetime.now().timestamp()})
                    elif message["type"] == "subscribe":
                        # Handle subscription requests
                        if "strategy_id" in message:
                            # Send initial data for the strategy
                            strategy_id = message["strategy_id"]

                            # Get strategy data
                            response = supabase.table("strategies").select("*").eq("id", strategy_id).execute()
                            if response.data and len(response.data) > 0:
                                strategy = response.data[0]

                                # Get budget
                                budget_response = supabase.table("strategy_budgets").select("*").eq("strategy_id", strategy_id).execute()
                                budget = budget_response.data[0] if budget_response.data else None

                                # Get trades
                                trades_response = supabase.table("trades").select("*").eq("strategy_id", strategy_id).order("created_at", {"ascending": False}).execute()
                                trades = trades_response.data

                                # Send data to client
                                await websocket.send_json({
                                    "type": "strategy_data",
                                    "strategy": strategy,
                                    "budget": budget,
                                    "trades": trades
                                })

                    # Add more message handlers as needed

            except json.JSONDecodeError:
                logger.error(f"Invalid JSON received from client {client_id}")
                await websocket.send_json({"error": "Invalid JSON"})
            except Exception as message_error:
                logger.error(f"Error processing message from client {client_id}: {str(message_error)}")
                await websocket.send_json({"error": str(message_error)})

    except WebSocketDisconnect:
        manager.disconnect(websocket, client_id)
    except Exception as ws_error:
        logger.error(f"WebSocket error for client {client_id}: {str(ws_error)}")
        manager.disconnect(websocket, client_id)

# Startup event
@app.on_event("startup")
async def startup_event():
    # Initialize the trading engine
    config = EngineConfig(
        demo_mode=True,  # Start in demo mode by default
        check_interval=60,
        max_trades_per_strategy=5,
        max_open_trades_total=20,
        risk_per_trade=0.02,
        default_stop_loss=0.01,
        default_take_profit=0.02,
        exchange="binance"
    )

    await trading_engine.initialize(config)

    # Start the trading engine
    await trading_engine.start()

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    # Stop the trading engine
    if trading_engine.is_running:
        await trading_engine.stop()

# Run the application
if __name__ == "__main__":
    import uvicorn
    import random  # For random price variations in demo mode

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
EOL

# Step 3: Create the Python backend requirements file
echo "Creating requirements.txt..."
cat > backend/python/requirements.txt << EOL
fastapi>=0.95.0
uvicorn>=0.21.1
websockets>=11.0.2
httpx>=0.24.0
python-dotenv>=1.0.0
pandas>=2.0.0
numpy>=1.24.3
supabase>=1.0.3
pydantic>=2.0.0
python-jose[cryptography]>=3.3.0
ccxt>=4.0.0
EOL

# Step 4: Create the Python backend .env file
echo "Creating .env file with existing keys..."
cat > backend/python/.env << EOL
# Supabase Configuration
SUPABASE_URL=https://gsuiserbzoebcdptglzm.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzdWlzZXJiem9lYmNkcHRnbHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM0MjE1MzgsImV4cCI6MjA1ODk5NzUzOH0.kSsWOfPW7RI3IXbCUzXi9oKK0zSC__-6p6ukfDJbk-k

# Deepseek API Configuration
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions
DEEPSEEK_API_KEY=sk-d218e91b203f45ebb4ede94cbed76478

# Binance API Configuration
BINANCE_API_KEY=
BINANCE_API_SECRET=
BINANCE_TESTNET_API_KEY=6dbf9bc5b8e03455128d00bab9ccaffb33fa812bfcf0b21bcb50cff355a88049
BINANCE_TESTNET_API_SECRET=4024ffff209db1b0681f8276fb9ba8425ae3883fc15176b622c11e7c4c8d53df

# Exchange Base URLs
BINANCE_BASE_URL=https://api.binance.com
BINANCE_TESTNET_BASE_URL=https://testnet.binance.vision
BINANCE_FUTURES_TESTNET_BASE_URL=https://testnet.binancefuture.com
BINANCE_TESTNET_WEBSOCKETS_URL=wss://testnet.binancefuture.com/ws-fapi/v1

# Trading Engine Configuration
DEMO_MODE_ENABLED=true
DEFAULT_DEMO_EXCHANGE=binance
MAX_STRATEGIES_PER_PROCESS=6
HEALTH_CHECK_INTERVAL=3000000
MARKET_FIT_CHECK_INTERVAL=1400000
RECOVERY_ATTEMPTS=10
EOL

# Step 5: Create the Python backend Dockerfile
echo "Creating Dockerfile for Python backend..."
cat > backend/python/Dockerfile << EOL
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
EOL

# Step 6: Create the Docker Compose file
echo "Creating docker-compose.yml..."
cat > docker-compose.yml << EOL
version: '3'

services:
  # Python Trading Engine
  trading-engine:
    build:
      context: ./backend/python
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - SUPABASE_URL=https://gsuiserbzoebcdptglzm.supabase.co
      - SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzdWlzZXJiem9lYmNkcHRnbHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM0MjE1MzgsImV4cCI6MjA1ODk5NzUzOH0.kSsWOfPW7RI3IXbCUzXi9oKK0zSC__-6p6ukfDJbk-k
      - DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions
        - DEEPSEEK_API_KEY=sk-d218e91b203f45ebb4ede94cbed76478
      - BINANCE_TESTNET_API_KEY=6dbf9bc5b8e03455128d00bab9ccaffb33fa812bfcf0b21bcb50cff355a88049
      - BINANCE_TESTNET_API_SECRET=4024ffff209db1b0681f8276fb9ba8425ae3883fc15176b622c11e7c4c8d53df
      - DEMO_MODE_ENABLED=true
      - DEFAULT_DEMO_EXCHANGE=binance
    volumes:
      - ./backend/python:/app
    restart: unless-stopped
EOL

# Step 7: Create a database setup script
echo "Creating database setup script..."
cat > backend/python/db_setup.py << 'EOL'
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

def setup_database():
    """Set up the necessary database tables if they don't exist"""
    try:
        # Check if strategy_budgets table exists
        print("Setting up strategy_budgets table...")

        # Create the table using SQL
        supabase.rpc('create_strategy_budgets_table', {}).execute()
        print("strategy_budgets table created or already exists")
    except Exception as e:
        print(f"Error creating strategy_budgets table: {str(e)}")
        print("Table may already exist or you may need to create it manually")

    print("Database setup complete")

if __name__ == "__main__":
    setup_database()
EOL

# Step 8: Create SQL function for database setup
echo "Creating SQL function for database setup..."
cat > backend/python/setup.sql << 'EOL'
-- Function to create strategy_budgets table if it doesn't exist
CREATE OR REPLACE FUNCTION create_strategy_budgets_table()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the table exists
  IF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'strategy_budgets'
  ) THEN
    -- Create the table
    CREATE TABLE public.strategy_budgets (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      strategy_id UUID NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
      total DECIMAL(18, 8) NOT NULL,
      allocated DECIMAL(18, 8) NOT NULL,
      available DECIMAL(18, 8) NOT NULL,
      max_position_size DECIMAL(18, 8) NOT NULL,
      last_updated BIGINT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Create index
    CREATE INDEX idx_strategy_budgets_strategy_id ON strategy_budgets(strategy_id);

    -- Add RLS policy
    ALTER TABLE public.strategy_budgets ENABLE ROW LEVEL SECURITY;

    -- Create policies
    CREATE POLICY "Users can view their own strategy budgets"
      ON public.strategy_budgets FOR SELECT
      USING (strategy_id IN (SELECT id FROM public.strategies WHERE user_id = auth.uid()));

    CREATE POLICY "Users can insert their own strategy budgets"
      ON public.strategy_budgets FOR INSERT
      WITH CHECK (strategy_id IN (SELECT id FROM public.strategies WHERE user_id = auth.uid()));

    CREATE POLICY "Users can update their own strategy budgets"
      ON public.strategy_budgets FOR UPDATE
      USING (strategy_id IN (SELECT id FROM public.strategies WHERE user_id = auth.uid()));

    CREATE POLICY "Users can delete their own strategy budgets"
      ON public.strategy_budgets FOR DELETE
      USING (strategy_id IN (SELECT id FROM public.strategies WHERE user_id = auth.uid()));

    -- Add trigger for updated_at
    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON public.strategy_budgets
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;
EOL

# Step 9: Create a README.md file
echo "Creating README.md..."
cat > README.md << 'EOL'
# Trading Engine Deployment

This repository contains a Python backend trading engine that integrates with your existing frontend.

## Quick Start

To deploy the trading engine with one command:

```bash
./deploy.sh
```
EOL

# Final step: Set permissions
chmod +x backend/python/db_setup.py
echo "Deployment script completed successfully!"

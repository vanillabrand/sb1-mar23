import backtrader as bt
import numpy as np

class BaseStrategy(bt.Strategy):
    params = (
        ('indicators', {}),
        ('entry_conditions', []),
        ('exit_conditions', []),
        ('risk_params', {})
    )

    def __init__(self):
        self.orders = {}
        self.indicators = {}
        
        # Initialize indicators
        for ind_id, ind_config in self.p.indicators.items():
            indicator_class = getattr(bt.indicators, ind_config['name'])
            self.indicators[ind_id] = indicator_class(
                self.data, **ind_config['params']
            )

    def next(self):
        if self.position.size == 0:  # No position
            if self.evaluate_conditions(self.p.entry_conditions):
                self.enter_position()
        else:  # Position exists
            if self.evaluate_conditions(self.p.exit_conditions):
                self.exit_position()
            else:
                self.manage_position()

    def evaluate_conditions(self, conditions):
        if not conditions:
            return False
            
        return all(eval(condition, {
            'indicators': self.indicators,
            'data': self.data,
            'np': np
        }) for condition in conditions)

    def enter_position(self):
        cash = self.broker.getcash()
        price = self.data.close[0]
        
        # Calculate position size based on risk parameters
        risk_amount = cash * self.p.risk_params['risk_per_trade']
        max_size = cash * self.p.risk_params['max_position_size'] / price
        
        size = min(risk_amount / price, max_size)
        
        # Place stop loss and take profit orders
        stop_price = price * (1 - self.p.risk_params['stop_loss'])
        target_price = price * (1 + self.p.risk_params['take_profit'])
        
        self.buy(size=size)
        self.sell(size=size, exectype=bt.Order.Stop, price=stop_price)
        self.sell(size=size, exectype=bt.Order.Limit, price=target_price)

    def exit_position(self):
        self.close()

    def manage_position(self):
        # Implement trailing stop or other position management logic here
        pass

    def notify_order(self, order):
        if order.status in [order.Completed, order.Canceled, order.Margin]:
            self.orders[order.ref] = None

    def notify_trade(self, trade):
        if trade.isclosed:
            self.log(f'TRADE CLOSED - Gross Profit: {trade.pnl:.2f}, '
                    f'Net Profit: {trade.pnlcomm:.2f}')

    def log(self, txt, dt=None):
        dt = dt or self.data.datetime.date(0)
        print(f'{dt.isoformat()} {txt}')
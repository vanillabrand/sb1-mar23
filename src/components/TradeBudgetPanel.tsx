import React, { useState, useEffect, useRef } from 'react';
import { Wallet, DollarSign, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { tradeService } from '../lib/trade-service';
import { logService } from '../lib/log-service';
import { eventBus } from '../lib/event-bus';
import type { StrategyBudget } from '../lib/types';

interface TradeBudgetPanelProps {
  strategyId: string;
  trades: any[];
  className?: string;
}

export const TradeBudgetPanel: React.FC<TradeBudgetPanelProps> = ({ strategyId, trades, className = '' }) => {
  const [budget, setBudget] = useState<StrategyBudget | null>(null);
  const [tradeCosts, setTradeCosts] = useState<Record<string, number>>({});
  const [tradeProfits, setTradeProfits] = useState<Record<string, number>>({});
  const [totalAllocated, setTotalAllocated] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);

  // Calculate trade costs and profits with memoization
  const lastTradesRef = useRef<any[]>([]);
  const lastCalculationTimeRef = useRef<number>(0);

  useEffect(() => {
    // Skip calculation if trades haven't changed
    const tradesChanged = !trades ||
      trades.length !== lastTradesRef.current.length ||
      JSON.stringify(trades.map(t => t.id)) !== JSON.stringify(lastTradesRef.current.map(t => t.id));

    // Throttle calculations to once every 2 seconds unless trades have changed
    const now = Date.now();
    const THROTTLE_MS = 2000;
    if (!tradesChanged && now - lastCalculationTimeRef.current < THROTTLE_MS) {
      return;
    }

    // Update refs
    lastTradesRef.current = trades || [];
    lastCalculationTimeRef.current = now;

    // Handle empty trades case
    if (!trades || trades.length === 0) {
      setTradeCosts({});
      setTradeProfits({});
      setTotalAllocated(0);
      setTotalProfit(0);
      return;
    }

    try {
      const costs: Record<string, number> = {};
      const profits: Record<string, number> = {};
      let allocatedSum = 0;
      let profitSum = 0;

      // Use a more efficient loop
      for (let i = 0; i < trades.length; i++) {
        const trade = trades[i];

        try {
          // Validate trade data
          if (!trade || !trade.id) {
            continue; // Skip this trade
          }

          // Calculate trade cost with validation
          const price = parseFloat(trade.entry_price || trade.entryPrice || trade.price || '0');
          const amount = parseFloat(trade.amount || trade.quantity || trade.size || '0');

          // Skip invalid values
          if (isNaN(price) || isNaN(amount) || price <= 0 || amount <= 0) {
            // Try to get cost from metadata if available
            if (trade.metadata?.tradeCost && !isNaN(parseFloat(trade.metadata.tradeCost))) {
              const metadataCost = parseFloat(trade.metadata.tradeCost);
              costs[trade.id] = Number(metadataCost.toFixed(2));

              // Only add to allocated sum for open or pending trades
              if (trade.status === 'open' || trade.status === 'pending' || trade.status === 'executed') {
                allocatedSum += metadataCost;
              }
            } else {
              // Use a default value of 0 to avoid NaN
              costs[trade.id] = 0;
            }
            continue; // Skip profit calculation for this trade
          }

          // Calculate and store the cost
          const cost = price * amount;
          const formattedCost = Number(cost.toFixed(2));
          costs[trade.id] = formattedCost;

          // Only add to allocated sum for open or pending trades
          if (trade.status === 'open' || trade.status === 'pending' || trade.status === 'executed') {
            allocatedSum += formattedCost;
          }

          // Calculate profit/loss for closed trades
          if (trade.status === 'closed' || trade.status === 'completed') {
            const exitPrice = parseFloat(trade.exit_price || trade.exitPrice || '0');

            if (exitPrice > 0) {
              const profit = trade.side === 'buy'
                ? (exitPrice - price) * amount
                : (price - exitPrice) * amount;

              const formattedProfit = Number(profit.toFixed(2));
              profits[trade.id] = formattedProfit;
              profitSum += formattedProfit;
            } else if (trade.profit !== undefined && !isNaN(parseFloat(trade.profit))) {
              // If we have a profit value directly, use it
              const formattedProfit = Number(parseFloat(trade.profit).toFixed(2));
              profits[trade.id] = formattedProfit;
              profitSum += formattedProfit;
            }
          }
        } catch (tradeError) {
          // Continue with next trade
          continue;
        }
      }

      // Format final values to avoid NaN
      const finalAllocated = isNaN(allocatedSum) ? 0 : Number(allocatedSum.toFixed(2));
      const finalProfit = isNaN(profitSum) ? 0 : Number(profitSum.toFixed(2));

      setTradeCosts(costs);
      setTradeProfits(profits);
      setTotalAllocated(finalAllocated);
      setTotalProfit(finalProfit);

      // Log for debugging - only log when values actually change
      if (finalAllocated !== totalAllocated || finalProfit !== totalProfit) {
        logService.log('debug', `Calculated trade costs and profits for strategy ${strategyId}`,
          { totalAllocated: finalAllocated, totalProfit: finalProfit }, 'TradeBudgetPanel');
      }
    } catch (error) {
      logService.log('error', `Error calculating trade costs for strategy ${strategyId}`, error, 'TradeBudgetPanel');
      // Set default values to avoid UI issues
      setTradeCosts({});
      setTradeProfits({});
      setTotalAllocated(0);
      setTotalProfit(0);
    }
  }, [trades, strategyId, totalAllocated, totalProfit]);

  // Get budget and subscribe to updates with debouncing
  useEffect(() => {
    let isMounted = true;
    let budgetUpdateTimeout: NodeJS.Timeout | null = null;

    // Debounced budget fetch to prevent multiple rapid requests
    const fetchBudget = () => {
      // Clear any pending timeout
      if (budgetUpdateTimeout) {
        clearTimeout(budgetUpdateTimeout);
      }

      // Set a new timeout to fetch budget after a short delay
      budgetUpdateTimeout = setTimeout(() => {
        try {
          const currentBudget = tradeService.getBudget(strategyId);
          if (currentBudget && isMounted) {
            setBudget(currentBudget);
            logService.log('debug', `Fetched budget for strategy ${strategyId}`,
              { budget: currentBudget }, 'TradeBudgetPanel');
          }
        } catch (error) {
          logService.log('error', `Error fetching budget for strategy ${strategyId}`, error, 'TradeBudgetPanel');
        }
      }, 300); // 300ms debounce
    };

    fetchBudget();

    // Subscribe to budget updates with debouncing
    const handleBudgetUpdate = (event: any) => {
      if (event.strategyId === strategyId && isMounted) {
        // Clear any pending timeout
        if (budgetUpdateTimeout) {
          clearTimeout(budgetUpdateTimeout);
        }

        // Set budget directly from the event without fetching
        setBudget(event.budget);
        logService.log('debug', `Budget updated for strategy ${strategyId}`,
          { budget: event.budget }, 'TradeBudgetPanel');
      }
    };

    // Subscribe to trade events to recalculate budget - with debouncing
    const handleTradeEvent = (event: any) => {
      if (event.trade?.strategy_id === strategyId ||
          event.strategyId === strategyId) {
        fetchBudget(); // Debounced budget refresh
      }
    };

    // Subscribe to events
    tradeService.on('budgetUpdated', handleBudgetUpdate);
    eventBus.subscribe('budget:updated', handleBudgetUpdate);

    // Use a single handler for both trade events to reduce duplicate code
    eventBus.subscribe('trade:created', handleTradeEvent);
    eventBus.subscribe('trade:closed', handleTradeEvent);

    // Cleanup
    return () => {
      isMounted = false;
      if (budgetUpdateTimeout) {
        clearTimeout(budgetUpdateTimeout);
      }
      tradeService.off('budgetUpdated', handleBudgetUpdate);
      eventBus.unsubscribe('budget:updated', handleBudgetUpdate);
      eventBus.unsubscribe('trade:created', handleTradeEvent);
      eventBus.unsubscribe('trade:closed', handleTradeEvent);
    };
  }, [strategyId]);

  // Reconcile budget with actual trade costs - with throttling
  const lastReconciliationRef = useRef<number>(0);

  useEffect(() => {
    if (!budget || !trades) return;

    const now = Date.now();

    // Throttle reconciliations to once every 5 seconds
    const THROTTLE_MS = 5000;
    if (now - lastReconciliationRef.current < THROTTLE_MS) {
      return;
    }

    // Set the last reconciliation time
    lastReconciliationRef.current = now;

    // Use a timeout to prevent immediate reconciliation
    const reconciliationTimeout = setTimeout(() => {
      try {
        // Ensure budget values are valid numbers
        const budgetTotal = isNaN(budget.total) ? 0 : Number(budget.total);
        const budgetAllocated = isNaN(budget.allocated) ? 0 : Number(budget.allocated);

        // Skip reconciliation if we have no trades or invalid budget
        if (trades.length === 0 || budgetTotal <= 0) return;

        // Only count open or pending trades for allocation
        const activeTrades = trades.filter(trade =>
          trade.status === 'open' || trade.status === 'pending' || trade.status === 'executed'
        );

        // Calculate actual allocated amount from active trades
        let actualAllocated = 0;

        activeTrades.forEach(trade => {
          try {
            const price = parseFloat(trade.entry_price || trade.entryPrice || trade.price || '0');
            const amount = parseFloat(trade.amount || trade.quantity || trade.size || '0');

            if (!isNaN(price) && !isNaN(amount) && price > 0 && amount > 0) {
              actualAllocated += price * amount;
            } else if (trade.metadata?.tradeCost && !isNaN(parseFloat(trade.metadata.tradeCost))) {
              actualAllocated += parseFloat(trade.metadata.tradeCost);
            }
          } catch (error) {
            // Skip this trade if there's an error
            logService.log('warn', `Error calculating cost for trade ${trade.id}`, error, 'TradeBudgetPanel');
          }
        });

        // Format to 2 decimal places
        const formattedActualAllocated = Number(actualAllocated.toFixed(2));

        // Check if the allocated amount in the budget matches the sum of trade costs
        const difference = Math.abs(budgetAllocated - formattedActualAllocated);

        // If there's a significant difference (more than $1), log it and update the budget
        if (difference > 1) {
          logService.log('warn', `Budget allocation mismatch for strategy ${strategyId}`,
            { budgetAllocated, calculatedAllocation: formattedActualAllocated, difference }, 'TradeBudgetPanel');

          // Calculate available budget (ensure it's not negative)
          const newAvailable = Math.max(0, budgetTotal - formattedActualAllocated);

          // Update the budget to match the actual trade costs
          const updatedBudget = {
            ...budget,
            allocated: formattedActualAllocated,
            available: Number(newAvailable.toFixed(2)),
            lastUpdated: Date.now()
          };

          // Update the budget cache - use the throttled method
          tradeService.throttledUpdateBudgetCache(strategyId, updatedBudget);

          logService.log('info', `Reconciled budget for strategy ${strategyId}`,
            { updatedBudget }, 'TradeBudgetPanel');
        }
      } catch (error) {
        logService.log('error', `Error reconciling budget for strategy ${strategyId}`, error, 'TradeBudgetPanel');
      }
    }, 500); // Delay reconciliation by 500ms

    // Clean up the timeout
    return () => {
      clearTimeout(reconciliationTimeout);
    };
  }, [budget, totalAllocated, trades, strategyId]);

  if (!budget) {
    return (
      <div className={`p-4 bg-gunmetal-900/50 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="w-4 h-4 text-neon-turquoise" />
          <h3 className="text-sm font-medium text-white">Trading Budget</h3>
        </div>
        <p className="text-xs text-gray-400">No budget information available</p>
      </div>
    );
  }

  return (
    <div className={`p-4 bg-gunmetal-900/50 rounded-lg ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-neon-turquoise" />
          <h3 className="text-sm font-medium text-white">Trading Budget</h3>
        </div>
        {totalProfit !== 0 && (
          <div className={`flex items-center gap-1 text-xs ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalProfit >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)} USDT</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-xs text-gray-400 mb-1">Total Budget</p>
          <p className="text-base font-medium text-white">
            ${isNaN(budget.total) ? '0.00' : Number(budget.total).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Available</p>
          <p className="text-base font-medium text-neon-turquoise">
            ${isNaN(budget.available) ? '0.00' : Number(budget.available).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </p>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <p className="text-xs text-gray-400">Allocated to Trades</p>
          <p className="text-xs text-white">
            ${isNaN(totalAllocated) ? '0.00' : Number(totalAllocated).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </p>
        </div>
        <div className="w-full bg-gunmetal-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-neon-pink h-full rounded-full"
            style={{
              width: `${isNaN(totalAllocated) || isNaN(budget.total) || budget.total <= 0
                ? 0
                : Math.min(100, (totalAllocated / budget.total) * 100)}%`
            }}
          ></div>
        </div>
      </div>

      {/* Trade Cost Breakdown */}
      {trades && trades.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-medium text-gray-400 mb-2">Trade Allocation</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {trades.map(trade => {
              // Skip invalid trades
              if (!trade || !trade.id) return null;

              // Format trade cost with fallback
              const tradeCost = tradeCosts[trade.id];
              const formattedCost = isNaN(tradeCost)
                ? '0.00'
                : Number(tradeCost).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});

              // Format profit with fallback
              const tradeProfit = tradeProfits[trade.id];
              const formattedProfit = tradeProfit === undefined || isNaN(tradeProfit)
                ? undefined
                : Number(tradeProfit).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});

              return (
                <div key={trade.id} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${
                      trade.status === 'closed' ? 'bg-green-400' :
                      trade.status === 'open' ? 'bg-neon-yellow' :
                      'bg-neon-turquoise'
                    }`}></span>
                    <span className="text-gray-300">{trade.symbol || 'Unknown'}</span>
                    <span className={`${trade.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                      {trade.side === 'buy' ? 'Buy' : 'Sell'}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-white">${formattedCost}</span>
                    {formattedProfit !== undefined && (
                      <span className={`text-[10px] ${tradeProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {tradeProfit >= 0 ? '+' : ''}{formattedProfit} USDT
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Budget Mismatch Warning */}
      {!isNaN(budget.allocated) && !isNaN(totalAllocated) && Math.abs(budget.allocated - totalAllocated) > 1 && (
        <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs flex items-start gap-1">
          <AlertCircle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
          <span className="text-red-300">
            Budget allocation mismatch detected. The system is reconciling the difference.
          </span>
        </div>
      )}
    </div>
  );
};

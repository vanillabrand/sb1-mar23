import React, { useEffect, useState } from 'react';
import { DollarSign } from 'lucide-react';
import { tradeService } from '../lib/trade-service';
import { eventBus } from '../lib/event-bus';
import { logService } from '../lib/log-service';
import { demoService } from '../lib/demo-service';
import { Trade } from '../lib/types';

interface BudgetPanelProps {
  strategyId: string;
  trades: Trade[];
}

export function BudgetPanel({ strategyId, trades }: BudgetPanelProps) {
  // State for budget values
  const [budget, setBudget] = useState<{
    total: number;
    allocated: number;
    available: number;
    profit: number;
    profitPercentage: number;
    allocationPercentage: number;
    remaining: number;
    lastUpdated?: number;
  } | null>(null);

  // Function to calculate and update budget
  const updateBudget = () => {
    try {
      // Get the latest budget from the trade service
      const serviceBudget = tradeService.getBudget(strategyId);
      if (!serviceBudget) return;

      // Check if we're in demo mode
      const isDemo = demoService.isInDemoMode();
      logService.log('debug', `Updating budget for strategy ${strategyId} in ${isDemo ? 'demo' : 'live'} mode`, null, 'BudgetPanel');

      // Calculate allocated budget from active trades
      let allocatedFromTrades = 0;
      let totalProfit = 0;

      // Process each trade to calculate allocated budget and profit
      trades.forEach(trade => {
        // Only count open or pending trades for allocation
        if (trade.status === 'open' || trade.status === 'pending') {
          // Calculate the trade cost (amount * entry price)
          const entryPrice = trade.entryPrice || trade.entry_price || 0;
          const amount = trade.amount || trade.quantity || 0;
          const tradeCost = entryPrice * amount;

          // Add to allocated budget
          if (tradeCost > 0) {
            allocatedFromTrades += tradeCost;
            logService.log('debug', `Trade ${trade.id} adds ${tradeCost.toFixed(2)} to allocated budget`, {
              entryPrice,
              amount,
              tradeCost,
              status: trade.status
            }, 'BudgetPanel');
          }
        }

        // Add profit/loss from all trades
        const tradeProfit = trade.profit || 0;
        totalProfit += tradeProfit;

        if (tradeProfit !== 0) {
          logService.log('debug', `Trade ${trade.id} has profit/loss of ${tradeProfit.toFixed(2)}`, {
            status: trade.status,
            profit: tradeProfit
          }, 'BudgetPanel');
        }
      });

      // In demo mode, we need to be more aggressive about updating the budget
      // because the trade service might not be properly updated
      if (isDemo) {
        logService.log('debug', `Demo mode budget calculation for strategy ${strategyId}`, {
          allocatedFromTrades,
          serviceAllocated: serviceBudget.allocated,
          tradesCount: trades.length,
          activeTradesCount: trades.filter(t => t.status === 'open' || t.status === 'pending').length
        }, 'BudgetPanel');
      }

      // If allocated from trades is different from service budget, update it
      // This ensures the budget is accurate even if the trade service hasn't been updated
      // In demo mode, we trust our calculation more than the service
      const allocated = isDemo ?
        allocatedFromTrades : // In demo mode, use our calculation
        Math.max(allocatedFromTrades, serviceBudget.allocated); // In live mode, use the higher value

      // Calculate available budget (total - allocated)
      const available = serviceBudget.total - allocated;

      // Calculate percentages
      const profitPercentage = serviceBudget.total > 0 ? (totalProfit / serviceBudget.total) * 100 : 0;
      const allocationPercentage = serviceBudget.total > 0 ? (allocated / serviceBudget.total) * 100 : 0;

      // Create the budget object
      const calculatedBudget = {
        total: serviceBudget.total,
        allocated: allocated,
        available: available,
        profit: totalProfit,
        profitPercentage,
        allocationPercentage,
        remaining: available,
        lastUpdated: Date.now(),
        isDemo // Add a flag to indicate if this is demo mode
      };

      // Update the budget state
      setBudget(calculatedBudget);

      // If our calculation is different from the service, update the service
      // In demo mode, always update the service to ensure it's accurate
      if (isDemo || Math.abs(allocated - serviceBudget.allocated) > 0.01 ||
          Math.abs(available - serviceBudget.available) > 0.01) {
        // Update the trade service budget
        const updatedBudget = {
          ...serviceBudget,
          allocated: allocated,
          available: available,
          lastUpdated: Date.now()
        };

        // Set the updated budget in the trade service
        tradeService.setBudget(strategyId, updatedBudget);

        logService.log('info', `Updated trade service budget for strategy ${strategyId} in ${isDemo ? 'demo' : 'live'} mode`, {
          before: serviceBudget,
          after: updatedBudget,
          allocatedFromTrades,
          tradesCount: trades.length
        }, 'BudgetPanel');
      }

      logService.log('info', `Updated budget for strategy ${strategyId} in ${isDemo ? 'demo' : 'live'} mode`, {
        budget: calculatedBudget,
        tradesCount: trades.length,
        activeTradesCount: trades.filter(t => t.status === 'open' || t.status === 'pending').length
      }, 'BudgetPanel');
    } catch (error) {
      logService.log('error', `Failed to update budget for strategy ${strategyId}`, error, 'BudgetPanel');
    }
  };

  // Initialize budget on component mount
  useEffect(() => {
    // Check if we're in demo mode
    const isDemo = demoService.isInDemoMode();
    updateBudget();

    // Subscribe to budget updates
    const handleBudgetUpdate = (data: any) => {
      if (data.strategyId === strategyId || (data.budgets && data.budgets[strategyId])) {
        logService.log('info', `Budget update received for strategy ${strategyId}`, data, 'BudgetPanel');
        updateBudget();
      }
    };

    // Subscribe to trade updates
    const handleTradeUpdate = (data: any) => {
      if (data.strategyId === strategyId || data.trade?.strategyId === strategyId) {
        logService.log('info', `Trade update received for strategy ${strategyId}`, data, 'BudgetPanel');
        updateBudget();
      }
    };

    // Generic handler for any event that might affect budget
    const handleAnyUpdate = () => {
      updateBudget();
    };

    // Subscribe to events with broader coverage
    eventBus.subscribe(`budgetUpdated:${strategyId}`, handleBudgetUpdate);
    eventBus.subscribe('budgetUpdated', handleBudgetUpdate);
    eventBus.subscribe(`trade:created:${strategyId}`, handleTradeUpdate);
    eventBus.subscribe(`trade:updated:${strategyId}`, handleTradeUpdate);
    eventBus.subscribe(`trade:executed:${strategyId}`, handleTradeUpdate);
    eventBus.subscribe(`trade:closed:${strategyId}`, handleTradeUpdate);
    eventBus.subscribe('trade:created', handleTradeUpdate);
    eventBus.subscribe('trade:updated', handleTradeUpdate);
    eventBus.subscribe('trade:executed', handleTradeUpdate);
    eventBus.subscribe('tradesUpdated', handleTradeUpdate);

    // Also subscribe to direct events from trade service
    tradeService.on('budgetUpdated', handleBudgetUpdate);
    tradeService.on('tradeCreated', handleTradeUpdate);
    tradeService.on('tradeUpdated', handleTradeUpdate);
    tradeService.on('tradeExecuted', handleTradeUpdate);
    tradeService.on('tradeClosed', handleTradeUpdate);

    // In demo mode, subscribe to additional events that might affect budget
    if (isDemo) {
      // Subscribe to websocket events that might indicate trade activity
      eventBus.subscribe('websocket:message', handleAnyUpdate);
      eventBus.subscribe('ticker', handleAnyUpdate);

      // Subscribe to demo-specific events
      eventBus.subscribe('demo:trade:created', handleAnyUpdate);
      eventBus.subscribe('demo:trade:updated', handleAnyUpdate);
      eventBus.subscribe('demo:trade:executed', handleAnyUpdate);

      // Set up more frequent refresh in demo mode (every 1 second)
      const demoRefreshInterval = setInterval(updateBudget, 1000);

      // Return cleanup function for demo-specific subscriptions
      return () => {
        // Unsubscribe from event bus
        eventBus.unsubscribe(`budgetUpdated:${strategyId}`, handleBudgetUpdate);
        eventBus.unsubscribe('budgetUpdated', handleBudgetUpdate);
        eventBus.unsubscribe(`trade:created:${strategyId}`, handleTradeUpdate);
        eventBus.unsubscribe(`trade:updated:${strategyId}`, handleTradeUpdate);
        eventBus.unsubscribe(`trade:executed:${strategyId}`, handleTradeUpdate);
        eventBus.unsubscribe(`trade:closed:${strategyId}`, handleTradeUpdate);
        eventBus.unsubscribe('trade:created', handleTradeUpdate);
        eventBus.unsubscribe('trade:updated', handleTradeUpdate);
        eventBus.unsubscribe('trade:executed', handleTradeUpdate);
        eventBus.unsubscribe('tradesUpdated', handleTradeUpdate);

        // Unsubscribe from demo-specific events
        eventBus.unsubscribe('websocket:message', handleAnyUpdate);
        eventBus.unsubscribe('ticker', handleAnyUpdate);
        eventBus.unsubscribe('demo:trade:created', handleAnyUpdate);
        eventBus.unsubscribe('demo:trade:updated', handleAnyUpdate);
        eventBus.unsubscribe('demo:trade:executed', handleAnyUpdate);

        // Unsubscribe from trade service
        tradeService.off('budgetUpdated', handleBudgetUpdate);
        tradeService.off('tradeCreated', handleTradeUpdate);
        tradeService.off('tradeUpdated', handleTradeUpdate);
        tradeService.off('tradeExecuted', handleTradeUpdate);
        tradeService.off('tradeClosed', handleTradeUpdate);

        clearInterval(demoRefreshInterval);
      };
    } else {
      // Set up standard refresh interval for live mode (every 2 seconds)
      const refreshInterval = setInterval(updateBudget, 2000);

      // Return cleanup function for standard subscriptions
      return () => {
        // Unsubscribe from event bus
        eventBus.unsubscribe(`budgetUpdated:${strategyId}`, handleBudgetUpdate);
        eventBus.unsubscribe('budgetUpdated', handleBudgetUpdate);
        eventBus.unsubscribe(`trade:created:${strategyId}`, handleTradeUpdate);
        eventBus.unsubscribe(`trade:updated:${strategyId}`, handleTradeUpdate);
        eventBus.unsubscribe(`trade:executed:${strategyId}`, handleTradeUpdate);
        eventBus.unsubscribe(`trade:closed:${strategyId}`, handleTradeUpdate);
        eventBus.unsubscribe('trade:created', handleTradeUpdate);
        eventBus.unsubscribe('trade:updated', handleTradeUpdate);
        eventBus.unsubscribe('trade:executed', handleTradeUpdate);
        eventBus.unsubscribe('tradesUpdated', handleTradeUpdate);

        // Unsubscribe from trade service
        tradeService.off('budgetUpdated', handleBudgetUpdate);
        tradeService.off('tradeCreated', handleTradeUpdate);
        tradeService.off('tradeUpdated', handleTradeUpdate);
        tradeService.off('tradeExecuted', handleTradeUpdate);
        tradeService.off('tradeClosed', handleTradeUpdate);

        clearInterval(refreshInterval);
      };
    }
  }, [strategyId, trades]);

  // Force budget recalculation when trades change
  useEffect(() => {
    // This effect will run whenever trades array changes
    updateBudget();
    logService.log('info', `Trades changed for strategy ${strategyId}, recalculating budget`, { tradesCount: trades.length }, 'BudgetPanel');
  }, [trades]);

  // If no budget is available, show loading state
  if (!budget) {
    return (
      <div>
        <h4 className="text-sm font-medium text-neon-turquoise mb-4 flex items-center gap-2 uppercase tracking-wider">
          <DollarSign className="w-4 h-4" />
          Trading Budget
        </h4>
        <div className="bg-gradient-to-r from-gunmetal-800 to-gunmetal-900 p-4 rounded-lg border border-gunmetal-700/50 shadow-inner animate-fadeIn">
          <div className="flex justify-center items-center h-20">
            <span className="text-gray-400">Loading budget information...</span>
          </div>
        </div>
      </div>
    );
  }

  // Check if we're in demo mode
  const isDemo = demoService.isInDemoMode();

  return (
    <div>
      <h4 className="text-sm font-medium text-neon-turquoise mb-4 flex items-center gap-2 uppercase tracking-wider">
        <DollarSign className="w-4 h-4" />
        Trading Budget
        {isDemo && (
          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full ml-2">DEMO</span>
        )}
      </h4>
      <div className="bg-gradient-to-r from-gunmetal-800 to-gunmetal-900 p-4 rounded-lg border border-gunmetal-700/50 shadow-inner animate-fadeIn">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Total Budget</span>
                <span className="text-md font-bold text-neon-yellow">${budget.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Available</span>
                <div className="flex items-center">
                  <span className="text-md font-bold text-neon-turquoise">${budget.available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  {budget.allocationPercentage !== undefined && (
                    <span className="text-xs text-gray-400 ml-1">({(100 - budget.allocationPercentage).toFixed(1)}%)</span>
                  )}
                </div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Allocated</span>
                <div className="flex items-center">
                  <span className="text-md font-bold text-neon-orange">${budget.allocated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  {budget.allocationPercentage !== undefined && (
                    <span className="text-xs text-gray-400 ml-1">({budget.allocationPercentage.toFixed(1)}%)</span>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Profit/Loss</span>
                <div className="flex items-center">
                  <span className={`text-md font-bold ${budget.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${budget.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {budget.profitPercentage !== undefined && (
                    <span className={`text-xs ml-1 ${budget.profit >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                      ({budget.profit >= 0 ? '+' : ''}{budget.profitPercentage.toFixed(2)}%)
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Remaining Budget</span>
                <div className="flex items-center">
                  <span className={`text-md font-bold ${budget.remaining && budget.remaining < 100 ? 'text-red-400' : 'text-neon-yellow'}`}>
                    ${budget.remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {budget.remaining && budget.remaining < 100 && (
                    <span className="text-xs text-red-400 ml-2">(Low)</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Budget warning if too low */}
          {budget.remaining && budget.remaining < 100 && (
            <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-md">
              <p className="text-xs text-red-400">
                <span className="font-bold">Warning:</span> Budget is too low to generate new trades. Add more funds to continue trading.
              </p>
            </div>
          )}

          {/* Budget progress bar */}
          {budget.total > 0 && (
            <div className="mt-2">
              <div className="h-2 w-full bg-gunmetal-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-neon-orange to-neon-yellow rounded-full"
                  style={{ width: `${Math.min(100, budget.allocationPercentage || 0)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Allocation</span>
                <span>{budget.allocationPercentage?.toFixed(1) || 0}%</span>
              </div>
            </div>
          )}

          {/* Demo mode indicator and last updated timestamp */}
          <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
            {isDemo && (
              <span className="text-blue-400">Demo Mode</span>
            )}
            {budget.lastUpdated && (
              <span>Last updated: {new Date(budget.lastUpdated).toLocaleTimeString()}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

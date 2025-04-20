import React, { useState, useEffect } from 'react';
import { budgetValidationService } from '../lib/budget-validation-service';
import { logService } from '../lib/log-service';

interface BudgetValidationStatusProps {
  strategyId: string;
  onValidationChange?: (isValid: boolean) => void;
}

const BudgetValidationStatus: React.FC<BudgetValidationStatusProps> = ({
  strategyId,
  onValidationChange
}) => {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    const validateBudget = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get the budget from the trade service
        const { tradeService } = await import('../lib/trade-service');
        const budget = tradeService.getBudget(strategyId);
        
        if (!budget) {
          setIsValid(null);
          setError('No budget found for this strategy');
          return;
        }
        
        // Validate the budget
        const valid = await budgetValidationService.validateBudget(strategyId, budget, true);
        setIsValid(valid);
        setLastChecked(new Date());
        
        if (onValidationChange) {
          onValidationChange(valid);
        }
        
        logService.log('info', `Budget validation for strategy ${strategyId}: ${valid ? 'Valid' : 'Invalid'}`, 
          { budget }, 'BudgetValidationStatus');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(`Validation failed: ${errorMessage}`);
        setIsValid(false);
        
        logService.log('error', `Budget validation failed for strategy ${strategyId}`, 
          err, 'BudgetValidationStatus');
          
        if (onValidationChange) {
          onValidationChange(false);
        }
      } finally {
        setLoading(false);
      }
    };

    validateBudget();
    
    // Subscribe to validation events
    const handleValidation = (event: CustomEvent) => {
      const data = event.detail;
      if (data.strategyId === strategyId) {
        setIsValid(data.isValid);
        setLastChecked(new Date());
        
        if (onValidationChange) {
          onValidationChange(data.isValid);
        }
      }
    };
    
    window.addEventListener('budget:validated', handleValidation as EventListener);
    
    return () => {
      window.removeEventListener('budget:validated', handleValidation as EventListener);
    };
  }, [strategyId, onValidationChange]);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get the budget from the trade service
      const { tradeService } = await import('../lib/trade-service');
      const budget = tradeService.getBudget(strategyId);
      
      if (!budget) {
        setIsValid(null);
        setError('No budget found for this strategy');
        return;
      }
      
      // Force validation
      const valid = await budgetValidationService.validateBudget(strategyId, budget, true);
      setIsValid(valid);
      setLastChecked(new Date());
      
      if (onValidationChange) {
        onValidationChange(valid);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Validation failed: ${errorMessage}`);
      setIsValid(false);
      
      if (onValidationChange) {
        onValidationChange(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-gray-300">Budget Validation</div>
        
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="text-xs text-gray-400 hover:text-white disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Refresh'}
        </button>
      </div>
      
      {error ? (
        <div className="text-red-500 text-xs">
          {error}
        </div>
      ) : isValid === null ? (
        <div className="text-gray-400 text-xs">
          No validation data available
        </div>
      ) : (
        <div className="flex items-center">
          {isValid ? (
            <div className="flex items-center text-green-500">
              <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              <span className="text-xs">Budget is valid</span>
            </div>
          ) : (
            <div className="flex items-center text-red-500">
              <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
              <span className="text-xs">Budget exceeds available balance</span>
            </div>
          )}
        </div>
      )}
      
      {lastChecked && (
        <div className="text-xs text-gray-400">
          Last checked: {lastChecked.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

export default BudgetValidationStatus;

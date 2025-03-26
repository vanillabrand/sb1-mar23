import { Strategy } from './supabase-types';
import { logService } from './log-service';

export class StrategyTranslator {
  static translateToBacktraderParams(strategy: Strategy): BacktraderParams {
    try {
      const { strategy_config } = strategy;
      if (!strategy_config?.indicators || !strategy_config?.conditions) {
        throw new Error('Invalid strategy configuration');
      }

      // Translate indicators
      const indicators = this.translateIndicators(strategy_config.indicators);
      
      // Translate entry/exit conditions
      const entryConditions = this.translateConditions(strategy_config.conditions.entry);
      const exitConditions = this.translateConditions(strategy_config.conditions.exit);

      // Translate risk parameters
      const riskParams = this.translateRiskParams(strategy_config.trade_parameters);

      return {
        indicators,
        entry_conditions: entryConditions,
        exit_conditions: exitConditions,
        risk_params: riskParams
      };
    } catch (error) {
      logService.log('error', 'Error translating strategy parameters', error, 'StrategyTranslator');
      throw error;
    }
  }

  private static translateIndicators(indicators: any[]): Record<string, any> {
    const translatedIndicators: Record<string, any> = {};

    indicators.forEach(indicator => {
      const params = {
        period: indicator.period || 14,
        ...indicator.parameters
      };

      switch (indicator.type.toLowerCase()) {
        case 'sma':
          translatedIndicators[indicator.id] = {
            name: 'SimpleMovingAverage',
            params: params
          };
          break;
        case 'ema':
          translatedIndicators[indicator.id] = {
            name: 'ExponentialMovingAverage',
            params: params
          };
          break;
        case 'rsi':
          translatedIndicators[indicator.id] = {
            name: 'RelativeStrengthIndex',
            params: params
          };
          break;
        case 'macd':
          translatedIndicators[indicator.id] = {
            name: 'MACD',
            params: {
              fast_period: params.fast_period || 12,
              slow_period: params.slow_period || 26,
              signal_period: params.signal_period || 9
            }
          };
          break;
        // Add more indicators as needed
      }
    });

    return translatedIndicators;
  }

  private static translateConditions(conditions: any[]): string[] {
    return conditions.map(condition => {
      const operator = this.translateOperator(condition.operator);
      const value = typeof condition.value === 'string' 
        ? `indicators.${condition.value}` 
        : condition.value;

      return `indicators.${condition.indicator} ${operator} ${value}`;
    });
  }

  private static translateOperator(operator: string): string {
    const operatorMap: Record<string, string> = {
      'greater_than': '>',
      'less_than': '<',
      'equals': '==',
      'greater_equal': '>=',
      'less_equal': '<=',
      'not_equal': '!='
    };
    return operatorMap[operator] || operator;
  }

  private static translateRiskParams(params: any): Record<string, any> {
    return {
      stop_loss: params.stop_loss || 0.02,
      take_profit: params.take_profit || 0.03,
      risk_per_trade: params.risk_per_trade || 0.01,
      max_position_size: params.max_position_size || 1.0
    };
  }
}
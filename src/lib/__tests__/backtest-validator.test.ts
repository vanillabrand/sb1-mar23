import { BacktestValidator } from '../backtest-validator';

// Mock the required types and data
interface BacktestResults {
  trades: any[];
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

interface Strategy {
  id: string;
  name: string;
}

const mockBacktestResults: BacktestResults = {
  trades: [],
  winRate: 0.6,
  sharpeRatio: 1.5,
  maxDrawdown: 0.15,
};

describe('BacktestValidator', () => {
  let validator: BacktestValidator;

  beforeEach(() => {
    validator = new BacktestValidator();
  });

  it('validates minimum trade count', async () => {
    const results = {
      ...mockBacktestResults,
      trades: Array(30).fill({})
    };
    const mockStrategy: Strategy = { id: '1', name: 'Test Strategy' };
    
    const report = await validator.validateBacktestResults(results, mockStrategy);
    expect(report.isValid).toBe(true);
  });

  it('detects overfitting', async () => {
    const results = {
      ...mockBacktestResults,
      winRate: 0.95,
      sharpeRatio: 4.0
    };
    const mockStrategy: Strategy = { id: '1', name: 'Test Strategy' };
    
    const report = await validator.validateBacktestResults(results, mockStrategy);
    expect(report.validations.find(v => v.name === 'Overfitting Check')).toBeDefined();
  });
});

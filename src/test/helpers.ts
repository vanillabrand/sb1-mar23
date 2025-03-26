import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

export const findByTestId = (testId: string, container?: HTMLElement) => {
  return container 
    ? within(container).getByTestId(testId)
    : screen.getByTestId(testId);
};

export const setupUserEvent = () => userEvent.setup();

export const mockAnalyticsService = {
  getMarketSentiment: jest.fn(),
  getVolatilityIndex: jest.fn(),
  getTrendStrength: jest.fn(),
  getLiquidityScore: jest.fn()
};

export const mockBacktestResults = {
  trades: [],
  winRate: 0.65,
  maxDrawdown: 0.15,
  sharpeRatio: 1.2,
  profitFactor: 1.5
};
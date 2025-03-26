import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import RiskManager from '../RiskManager';
import { analyticsService } from '../../lib/analytics-service';

jest.mock('../../lib/analytics-service');

describe('RiskManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<RiskManager />);
    expect(screen.getByText('Risk Management Dashboard')).toBeInTheDocument();
  });

  it('loads and displays risk metrics', async () => {
    const mockMetrics = {
      volatilityIndex: 65,
      marketSentiment: 'bullish',
      trendStrength: 80,
      liquidityScore: 75
    };

    (analyticsService.getMarketSentiment as jest.Mock).mockResolvedValue(mockMetrics.marketSentiment);
    (analyticsService.getVolatilityIndex as jest.Mock).mockResolvedValue(mockMetrics.volatilityIndex);

    render(<RiskManager />);

    await waitFor(() => {
      expect(screen.getByText('Bullish')).toBeInTheDocument();
      expect(screen.getByText('65')).toBeInTheDocument();
    });
  });

  it('handles refresh button click', async () => {
    render(<RiskManager />);
    const refreshButton = screen.getByRole('button', { name: /refresh/i });

    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(analyticsService.getMarketSentiment).toHaveBeenCalled();
      expect(analyticsService.getVolatilityIndex).toHaveBeenCalled();
    });
  });
});
import { render, screen, waitFor } from '../../test/test-utils';
import Dashboard from '../Dashboard';
import { mockAnalyticsService } from '../../test/helpers';

jest.mock('../../lib/analytics-service', () => mockAnalyticsService);

describe('Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dashboard components', () => {
    render(<Dashboard />);
    expect(screen.getByText(/Trading Dashboard/i)).toBeInTheDocument();
  });

  it('loads market data', async () => {
    mockAnalyticsService.getMarketSentiment.mockResolvedValue('bullish');
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText(/bullish/i)).toBeInTheDocument();
    });
  });
});
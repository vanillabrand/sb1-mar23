import { render, screen, waitFor } from '../../test/test-utils';
import { App } from '../../App';
import { mockAnalyticsService } from '../../test/helpers';

jest.mock('../../lib/analytics-service', () => mockAnalyticsService);

describe('Trading Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('completes full trading workflow', async () => {
    render(<App />);

    // Navigate to strategy manager
    await screen.findByText(/Strategy Manager/i);
    screen.getByText(/Strategy Manager/i).click();

    // Create strategy
    screen.getByText(/New Strategy/i).click();
    await waitFor(() => {
      expect(screen.getByText(/Save Strategy/i)).toBeInTheDocument();
    });

    // Verify risk management integration
    screen.getByText(/Risk Manager/i).click();
    await waitFor(() => {
      expect(screen.getByText(/Risk Management Dashboard/i)).toBeInTheDocument();
    });
  });
});
import { rest } from 'msw';

export const handlers = [
  rest.get('/api/market-metrics', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        volatilityIndex: 65,
        marketSentiment: 'bullish',
        trendStrength: 80,
        liquidityScore: 75
      })
    );
  }),

  rest.post('/api/backtest', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ...mockBacktestResults,
        trades: Array(30).fill({})
      })
    );
  }),

  rest.get('/api/strategies', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        {
          id: '1',
          name: 'MA Crossover',
          description: 'Moving average crossover strategy'
        }
      ])
    );
  })
];

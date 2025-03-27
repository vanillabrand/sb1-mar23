import { aiMarketService } from '../lib/ai-market-service';

// Inside your component
const getMarketAnalysis = async () => {
  const assets = ['BTC/USDT', 'ETH/USDT'];
  try {
    const insights = await aiMarketService.getMarketInsights(assets);
    // Use the insights in your UI
    console.log(insights);
  } catch (error) {
    console.error('Failed to get market insights:', error);
  }
};
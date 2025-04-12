import { AIService } from './ai-service';
import { marketMonitor } from './market-monitor';
import { logService } from './log-service';
import { exchangeService } from './exchange-service';
import { Strategy } from './types';
import { strategyMetricsCalculator } from './strategy-metrics-calculator';

export class StrategyTemplateGenerator {
  private static instance: StrategyTemplateGenerator;
  private readonly RISK_LEVELS = ['Ultra Low', 'Low', 'Medium', 'High', 'Ultra High', 'God Mode'];
  private readonly DEFAULT_MARKETS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT'];
  private readonly MAX_TEMPLATES = 6;

  private constructor() {}

  static getInstance(): StrategyTemplateGenerator {
    if (!StrategyTemplateGenerator.instance) {
      StrategyTemplateGenerator.instance = new StrategyTemplateGenerator();
    }
    return StrategyTemplateGenerator.instance;
  }

  async generateOptimizedTemplates(): Promise<Strategy[]> {
    try {
      // 1. Gather current market conditions
      const marketData = await this.gatherMarketData();

      // 2. Generate strategy templates using DeepSeek
      const templates = await this.generateTemplatesWithAI(marketData);

      // 3. Validate and optimize templates
      const optimizedTemplates = await this.optimizeTemplates(templates || []); // Add fallback empty array

      return optimizedTemplates.slice(0, this.MAX_TEMPLATES);
    } catch (error) {
      logService.log('error', 'Failed to generate strategy templates', error, 'StrategyTemplateGenerator');
      throw error;
    }
  }

  private async gatherMarketData(): Promise<any> {
    try {
      // Initialize demo exchange if not already done
      if (!exchangeService.isInitialized()) {
        await exchangeService.initializeExchange({
          name: 'binance',
          apiKey: 'demo-api-key',
          secret: 'demo-secret',
          testnet: true,
          useUSDX: false
        });
      }

      // Wait for exchange to be ready
      await exchangeService.waitForReady();

      const marketData = await Promise.all(this.DEFAULT_MARKETS.map(async (asset) => {
        try {
          // Get ticker data using exchange service
          const ticker = await exchangeService.fetchTicker(asset);

          // Get historical data from market monitor
          const historicalData = await marketMonitor.getHistoricalData(asset, 100);

          return {
            asset,
            currentPrice: ticker.last,
            volume24h: ticker.baseVolume,
            priceHistory: historicalData,
            marketState: marketMonitor.getMarketState(asset)
          };
        } catch (error) {
          logService.log('error', `Failed to fetch market data for ${asset}`, error, 'StrategyTemplateGenerator');
          return null;
        }
      }));

      // Filter out any null values from failed requests
      return marketData.filter(data => data !== null);
    } catch (error) {
      logService.log('error', 'Failed to gather market data', error, 'StrategyTemplateGenerator');
      throw error;
    }
  }

  private async generateTemplatesWithAI(marketData: any): Promise<Strategy[]> {
    try {
      const prompt = `Generate ${this.MAX_TEMPLATES} diverse trading strategy templates optimized for current market conditions.

Market Data:
${JSON.stringify(marketData, null, 2)}

Requirements:
1. Each strategy should target different risk levels
2. Include specific technical indicators and parameters
3. Optimize for current market conditions
4. Include precise entry/exit rules
5. Define risk management parameters
6. Provide expected metrics (win rate, avg return)

Return an array of strategy objects with this exact structure:
{
  title: string,
  description: string,
  risk_level: string (one of: ${this.RISK_LEVELS.join(', ')}),
  metrics: {
    winRate: number,
    avgReturn: number
  },
  strategy_config: {
    indicators: object,
    timeframe: string,
    entry_rules: string[],
    exit_rules: string[],
    risk_management: {
      stopLoss: number,
      takeProfit: number,
      maxDrawdown: number
    }
  }
}`;

      const aiService = AIService.getInstance();

      // Use generateDetailedStrategies to get an array of strategies
      const generatedTemplates = await aiService.generateDetailedStrategies(
        this.DEFAULT_MARKETS,
        this.RISK_LEVELS.slice(0, this.MAX_TEMPLATES) // Use the first MAX_TEMPLATES risk levels
      );

      logService.log('info', `Generated ${generatedTemplates.length} strategy templates`, null, 'StrategyTemplateGenerator');

      if (!generatedTemplates || !Array.isArray(generatedTemplates)) {
        logService.log('warn', 'AI service returned invalid templates', { generatedTemplates }, 'StrategyTemplateGenerator');
        return [];
      }

      return generatedTemplates;
    } catch (error) {
      logService.log('error', 'Failed to generate templates with AI', error, 'StrategyTemplateGenerator');
      return [];
    }
  }

  private async optimizeTemplates(templates: Strategy[]): Promise<Strategy[]> {
    if (!templates || !Array.isArray(templates)) {
      logService.log('warn', 'No templates provided for optimization, returning empty array', null, 'StrategyTemplateGenerator');
      return [];
    }

    return templates.map(template => {
      // Calculate realistic metrics for the template
      const winRate = strategyMetricsCalculator.calculateWinRate(template);
      const avgReturn = strategyMetricsCalculator.calculatePotentialProfit(template);

      // Ensure template has metrics object
      if (!template.metrics) {
        template.metrics = { winRate: 0, avgReturn: 0 };
      }

      // Update metrics with calculated values
      template.metrics.winRate = parseFloat(winRate.toFixed(1));
      template.metrics.avgReturn = parseFloat(avgReturn.toFixed(1));

      logService.log('info', `Optimized template metrics: ${template.title}`, {
        winRate: template.metrics.winRate,
        avgReturn: template.metrics.avgReturn
      }, 'StrategyTemplateGenerator');

      return {
        ...template,
        id: crypto.randomUUID(),
        type: 'system_template',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });
  }
}

export const strategyTemplateGenerator = StrategyTemplateGenerator.getInstance();

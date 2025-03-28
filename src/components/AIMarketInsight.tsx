import React, { useState, useEffect } from 'react';
import { Brain, RefreshCw, Loader2 } from 'lucide-react';
import { aiMarketService } from '../lib/ai-market-service';
import { ErrorBoundary } from './ErrorBoundary';

interface AIMarketInsightProps {
  assets: Set<string>;
  className?: string;
}

interface SentimentDistribution {
  bullish: number;
  neutral: number;
  bearish: number;
}

const DEFAULT_DISTRIBUTION: SentimentDistribution = {
  bullish: 33,
  neutral: 34,
  bearish: 33
};

function AIMarketInsightContent({ assets, className = "" }: AIMarketInsightProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sentimentDistribution, setSentimentDistribution] = 
    useState<SentimentDistribution>(DEFAULT_DISTRIBUTION);

  const calculateSentimentDistribution = (marketInsights: any): SentimentDistribution => {
    if (!marketInsights?.assets?.length) {
      return DEFAULT_DISTRIBUTION;
    }

    const distribution = marketInsights.assets.reduce((acc: any, asset: any) => {
      const sentiment = asset?.sentiment?.toLowerCase() || 'neutral';
      acc[sentiment] = (acc[sentiment] || 0) + 1;
      return acc;
    }, { bullish: 0, neutral: 0, bearish: 0 });

    const total = marketInsights.assets.length;
    return {
      bullish: Math.round((distribution.bullish / total) * 100) || 0,
      neutral: Math.round((distribution.neutral / total) * 100) || 0,
      bearish: Math.round((distribution.bearish / total) * 100) || 0
    };
  };

  const fetchInsights = async () => {
    try {
      setError(null);
      setLoading(true);
      
      const assetList = assets.size > 0 
        ? Array.from(assets)
        : ['BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'BNB_USDT'];
      
      const marketInsights = await aiMarketService.getMarketInsights(assetList);
      setInsights(marketInsights);
      
      const distribution = calculateSentimentDistribution(marketInsights);
      setSentimentDistribution(distribution);
    } catch (err) {
      setError('Failed to generate market insights');
      console.error('Error fetching market insights:', err);
      setSentimentDistribution(DEFAULT_DISTRIBUTION);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [assets]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchInsights();
  };

  if (loading && !insights) {
    return (
      <div className={`${className} flex items-center justify-center h-[300px]`}>
        <Loader2 className="w-8 h-8 text-neon-turquoise animate-spin" />
      </div>
    );
  }

  if (error && !insights) {
    return (
      <div className={`${className} flex flex-col items-center justify-center h-[300px]`}>
        <p className="text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-neon-turquoise" />
          <h2 className="text-lg font-semibold gradient-text">AI Market Insight</h2>
        </div>
        <button 
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 bg-gunmetal-800/50 rounded-lg text-gray-400 hover:text-neon-turquoise transition-all disabled:opacity-50"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </button>
      </div>
      
      <div className="space-y-6">
        {/* Strategic Recommendations */}
        {insights?.recommendations?.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-neon-turquoise mb-3">
              Strategic Recommendations
            </h3>
            <div className="grid gap-3">
              {insights.recommendations.map((rec: string, index: number) => (
                <div 
                  key={index}
                  className="bg-gunmetal-800/30 rounded-lg p-4 hover:bg-gunmetal-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-neon-turquoise"></div>
                    <p className="text-sm text-gray-300">{rec}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sentiment Distribution */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gunmetal-800/30 rounded-lg p-4">
            <div className="text-2xl font-bold text-neon-turquoise mb-1">
              {sentimentDistribution?.bullish ?? 0}%
            </div>
            <div className="text-sm text-gray-400">Bullish Signals</div>
          </div>
          <div className="bg-gunmetal-800/30 rounded-lg p-4">
            <div className="text-2xl font-bold text-neon-yellow mb-1">
              {sentimentDistribution?.neutral ?? 0}%
            </div>
            <div className="text-sm text-gray-400">Neutral Signals</div>
          </div>
          <div className="bg-gunmetal-800/30 rounded-lg p-4">
            <div className="text-2xl font-bold text-neon-pink mb-1">
              {sentimentDistribution?.bearish ?? 0}%
            </div>
            <div className="text-sm text-gray-400">Bearish Signals</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AIMarketInsight(props: AIMarketInsightProps) {
  return (
    <ErrorBoundary fallback={
      <div className="p-4 bg-gunmetal-800/30 rounded-lg">
        <p className="text-gray-400">Failed to load market insights</p>
      </div>
    }>
      <AIMarketInsightContent {...props} />
    </ErrorBoundary>
  );
}

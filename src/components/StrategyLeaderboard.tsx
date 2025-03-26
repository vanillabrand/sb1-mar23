import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy,
  Medal,
  Crown,
  Star,
  TrendingUp,
  Users,
  Search,
  SortAsc,
  SortDesc,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logService } from '../lib/log-service';
import { CircularProgress } from './CircularProgress';
import { Pagination } from './ui/Pagination';
import { useScreenSize, ITEMS_PER_PAGE } from '../lib/hooks/useScreenSize';

interface LeaderboardEntry {
  id: string;
  title: string;
  description: string;
  risk_level: string;
  performance: number;
  user_id: string;
  user_name: string;
  trades_count: number;
  win_rate: number;
  created_at: string;
}

export function StrategyLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'performance' | 'win_rate'>('performance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(0);
  const screenSize = useScreenSize();
  const itemsPerPage = ITEMS_PER_PAGE[screenSize];

  useEffect(() => {
    loadLeaderboard();
    
    // Subscribe to strategy updates
    const subscription = supabase
      .channel('strategy_performance')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'strategies' 
      }, () => {
        loadLeaderboard();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('strategies')
        .select(`
          id,
          title,
          description,
          risk_level,
          performance,
          user_id,
          created_at,
          user_profiles (
            first_name,
            last_name
          ),
          strategy_trades (
            id,
            pnl
          )
        `)
        .order('performance', { ascending: false })
        .limit(100);

      if (error) throw error;

      const formattedEntries = data.map(strategy => {
        const trades = strategy.strategy_trades || [];
        const winningTrades = trades.filter((t: any) => t.pnl > 0);
        const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;

        return {
          id: strategy.id,
          title: strategy.title,
          description: strategy.description,
          risk_level: strategy.risk_level,
          performance: strategy.performance || 0,
          user_id: strategy.user_id,
          user_name: strategy.user_profiles?.first_name 
            ? `${strategy.user_profiles.first_name} ${strategy.user_profiles.last_name?.charAt(0) || ''}.`
            : 'Anonymous',
          trades_count: trades.length,
          win_rate: winRate,
          created_at: strategy.created_at
        };
      });

      setEntries(formattedEntries);
    } catch (error) {
      logService.log('error', 'Failed to load leaderboard', error, 'StrategyLeaderboard');
      setError('Failed to load leaderboard data');
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = React.useMemo(() => {
    return entries
      .filter(entry => 
        entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.user_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      });
  }, [entries, searchTerm, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  const displayedEntries = filteredEntries.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Trophy className="w-6 h-6 text-yellow-400" />;
      case 1: return <Medal className="w-6 h-6 text-gray-400" />;
      case 2: return <Medal className="w-6 h-6 text-amber-600" />;
      default: return <Star className="w-6 h-6 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 text-neon-raspberry animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-neon-pink/10 border border-neon-pink/20 rounded-lg p-4 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-neon-pink" />
        <p className="text-neon-pink">{error}</p>
      </div>
    );
  }

  return (
    <motion.div 
      layout
      className="min-h-[400px]" // Prevent layout jumps
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crown className="w-6 h-6 text-neon-yellow" />
            <h2 className="text-xl font-bold gradient-text">Strategy Leaderboard</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-400">
                {entries.length} Strategies
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search strategies or traders..."
              className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as 'performance' | 'win_rate')}
              className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
            >
              <option value="performance">Performance</option>
              <option value="win_rate">Win Rate</option>
            </select>

            <button
              onClick={() => setSortOrder(order => order === 'asc' ? 'desc' : 'asc')}
              className="p-2 bg-gunmetal-800 rounded-lg text-gray-400 hover:text-neon-turquoise transition-colors"
            >
              {sortOrder === 'asc' ? (
                <SortAsc className="w-5 h-5" />
              ) : (
                <SortDesc className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {displayedEntries.map((entry, index) => {
            const rank = currentPage * itemsPerPage + index + 1;
            
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gunmetal-800/30 rounded-xl p-6 hover:bg-gunmetal-800/50 transition-all duration-300"
              >
                <div className="grid grid-cols-12 gap-6 items-center">
                  {/* Rank */}
                  <div className="col-span-1 flex items-center justify-center">
                    <div className="relative">
                      {getRankIcon(index)}
                      <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-xs font-medium text-gray-400">
                        #{rank}
                      </span>
                    </div>
                  </div>

                  {/* Strategy Info */}
                  <div className="col-span-4">
                    <h3 className="text-lg font-semibold text-gray-200">{entry.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-gray-400">{entry.user_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full bg-gunmetal-900/50 ${
                        entry.risk_level === 'High' ? 'text-neon-pink' :
                        entry.risk_level === 'Medium' ? 'text-neon-yellow' :
                        'text-neon-turquoise'
                      }`}>
                        {entry.risk_level}
                      </span>
                    </div>
                  </div>

                  {/* Performance */}
                  <div className="col-span-3 flex items-center gap-6">
                    <CircularProgress
                      value={entry.performance}
                      size={50}
                      color={entry.performance >= 0 ? '#2dd4bf' : '#ec4899'}
                      className="flex-shrink-0"
                    />
                    <div>
                      <p className="text-sm text-gray-400">Performance</p>
                      <p className={`text-lg font-bold ${
                        entry.performance >= 0 ? 'text-neon-turquoise' : 'text-neon-pink'
                      }`}>
                        {entry.performance >= 0 ? '+' : ''}{entry.performance.toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  {/* Win Rate */}
                  <div className="col-span-2">
                    <p className="text-sm text-gray-400">Win Rate</p>
                    <p className="text-lg font-bold text-neon-yellow">
                      {entry.win_rate.toFixed(1)}%
                    </p>
                  </div>

                  {/* Trade Count */}
                  <div className="col-span-2">
                    <p className="text-sm text-gray-400">Total Trades</p>
                    <p className="text-lg font-bold text-gray-200">
                      {entry.trades_count}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid gap-4"
          >
            {displayedEntries.map((entry, index) => {
              const rank = currentPage * itemsPerPage + index + 1;
              
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gunmetal-800/30 rounded-xl p-6 hover:bg-gunmetal-800/50 transition-all duration-300"
                >
                  <div className="grid grid-cols-12 gap-6 items-center">
                    {/* Rank */}
                    <div className="col-span-1 flex items-center justify-center">
                      <div className="relative">
                        {getRankIcon(index)}
                        <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-xs font-medium text-gray-400">
                          #{rank}
                        </span>
                      </div>
                    </div>

                    {/* Strategy Info */}
                    <div className="col-span-4">
                      <h3 className="text-lg font-semibold text-gray-200">{entry.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-gray-400">{entry.user_name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full bg-gunmetal-900/50 ${
                          entry.risk_level === 'High' ? 'text-neon-pink' :
                          entry.risk_level === 'Medium' ? 'text-neon-yellow' :
                          'text-neon-turquoise'
                        }`}>
                          {entry.risk_level}
                        </span>
                      </div>
                    </div>

                    {/* Performance */}
                    <div className="col-span-3 flex items-center gap-6">
                      <CircularProgress
                        value={entry.performance}
                        size={50}
                        color={entry.performance >= 0 ? '#2dd4bf' : '#ec4899'}
                        className="flex-shrink-0"
                      />
                      <div>
                        <p className="text-sm text-gray-400">Performance</p>
                        <p className={`text-lg font-bold ${
                          entry.performance >= 0 ? 'text-neon-turquoise' : 'text-neon-pink'
                        }`}>
                          {entry.performance >= 0 ? '+' : ''}{entry.performance.toFixed(2)}%
                        </p>
                      </div>
                    </div>

                    {/* Win Rate */}
                    <div className="col-span-2">
                      <p className="text-sm text-gray-400">Win Rate</p>
                      <p className="text-lg font-bold text-neon-yellow">
                        {entry.win_rate.toFixed(1)}%
                      </p>
                    </div>

                    {/* Trade Count */}
                    <div className="col-span-2">
                      <p className="text-sm text-gray-400">Total Trades</p>
                      <p className="text-lg font-bold text-gray-200">
                        {entry.trades_count}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          showPageNumbers={screenSize !== 'sm'}
          itemsPerPage={itemsPerPage}
          totalItems={entries.length}
          loading={loading}
          className="mt-6"
        />
      </div>
    </motion.div>
  );
}

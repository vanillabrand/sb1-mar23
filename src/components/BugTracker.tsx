  import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bug, 
  Plus, 
  AlertCircle, 
  Clock, 
  User, 
  Tag,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Loader2,
  ChevronDown,
  X,
  Check
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { logService } from '../lib/log-service';
import { Pagination } from './ui/Pagination';
import { useScreenSize, ITEMS_PER_PAGE } from '../lib/hooks/useScreenSize';

interface BugReport {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  reported_by: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

export default function BugTracker() {
  const { user } = useAuth();
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewBugModal, setShowNewBugModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'created_at' | 'priority'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedBug, setSelectedBug] = useState<string | null>(null);
  const screenSize = useScreenSize();
  const itemsPerPage = ITEMS_PER_PAGE[screenSize];
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    fetchBugs();
    
    // Subscribe to realtime updates
    const subscription = supabase
      .channel('bug_reports_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'bug_reports' 
      }, handleRealtimeUpdate)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleRealtimeUpdate = (payload: any) => {
    if (payload.eventType === 'INSERT') {
      setBugs(prev => [payload.new, ...prev]);
    } else if (payload.eventType === 'UPDATE') {
      setBugs(prev => prev.map(bug => 
        bug.id === payload.new.id ? payload.new : bug
      ));
    } else if (payload.eventType === 'DELETE') {
      setBugs(prev => prev.filter(bug => bug.id !== payload.old.id));
    }
  };

  const fetchBugs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bug_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBugs(data || []);
    } catch (err) {
      setError('Failed to fetch bug reports');
      logService.log('error', 'Failed to fetch bug reports:', err, 'BugTracker');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitBug = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const newBug = {
        title: formData.get('title') as string,
        description: formData.get('description') as string,
        status: 'open' as const,
        priority: formData.get('priority') as BugReport['priority'],
        reported_by: user?.id as string
      };

      const { error } = await supabase
        .from('bug_reports')
        .insert([newBug]);

      if (error) throw error;

      setShowNewBugModal(false);
      form.reset();
    } catch (err) {
      setError('Failed to submit bug report');
      logService.log('error', 'Failed to submit bug report:', err, 'BugTracker');
    }
  };

  const handleUpdateStatus = async (bugId: string, newStatus: BugReport['status']) => {
    try {
      const { error } = await supabase
        .from('bug_reports')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', bugId);

      if (error) throw error;
    } catch (err) {
      setError('Failed to update bug status');
      logService.log('error', 'Failed to update bug status:', err, 'BugTracker');
    }
  };

  const filteredBugs = bugs.filter(bug => {
    const matchesSearch = bug.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bug.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || bug.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || bug.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  }).sort((a, b) => {
    switch (sortField) {
      case 'priority':
        const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
        const diff = priorityOrder[b.priority] - priorityOrder[a.priority];
        return sortOrder === 'asc' ? -diff : diff;
      default:
        const dateA = new Date(a[sortField]).getTime();
        const dateB = new Date(b[sortField]).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    }
  });

  const totalPages = Math.ceil(filteredBugs.length / itemsPerPage);
  const displayedBugs = filteredBugs.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const getStatusColor = (status: BugReport['status']) => {
    switch (status) {
      case 'open': return 'text-neon-yellow';
      case 'in_progress': return 'text-neon-orange';
      case 'resolved': return 'text-neon-turquoise';
      case 'closed': return 'text-gray-400';
    }
  };

  const getPriorityColor = (priority: BugReport['priority']) => {
    switch (priority) {
      case 'critical': return 'text-neon-pink';
      case 'high': return 'text-neon-orange';
      case 'medium': return 'text-neon-yellow';
      case 'low': return 'text-neon-turquoise';
    }
  };

  return (
    <motion.div layout className="min-h-[500px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-neon-raspberry animate-spin" />
            </div>
          ) : filteredBugs.length === 0 ? (
            <div className="text-center py-12">
              <Bug className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-300 text-lg mb-2">No bug reports found</p>
              <p className="text-gray-400">
                {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Report a bug to get started'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedBugs.map((bug) => (
                <motion.div
                  key={bug.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gunmetal-800/30 rounded-xl overflow-hidden"
                >
                  <div 
                    className="p-6 cursor-pointer"
                    onClick={() => setSelectedBug(selectedBug === bug.id ? null : bug.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`transform transition-transform ${selectedBug === bug.id ? 'rotate-180' : ''}`}>
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-200">{bug.title}</h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span className={`text-sm ${getStatusColor(bug.status)}`}>
                              {bug.status.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className={`text-sm ${getPriorityColor(bug.priority)}`}>
                              {bug.priority.toUpperCase()}
                            </span>
                            <span className="text-sm text-gray-400">
                              {new Date(bug.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {selectedBug === bug.id && (
                      <div className="mt-4 space-y-4">
                        <p className="text-gray-300 whitespace-pre-wrap">{bug.description}</p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <User className="w-4 h-4 text-neon-turquoise" />
                              <span className="text-xs text-gray-400">Reported By</span>
                            </div>
                            <p className="text-sm text-gray-200">User #{bug.reported_by.slice(0, 8)}</p>
                          </div>

                          <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <Clock className="w-4 h-4 text-neon-yellow" />
                              <span className="text-xs text-gray-400">Created</span>
                            </div>
                            <p className="text-sm text-gray-200">
                              {new Date(bug.created_at).toLocaleString()}
                            </p>
                          </div>

                          <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <Tag className="w-4 h-4 text-neon-orange" />
                              <span className="text-xs text-gray-400">Status</span>
                            </div>
                            <select
                              value={bug.status}
                              onChange={(e) => handleUpdateStatus(bug.id, e.target.value as BugReport['status'])}
                              className="bg-transparent text-sm font-medium focus:outline-none focus:ring-0 border-0 p-0"
                            >
                              <option value="open" className="bg-gunmetal-900">Open</option>
                              <option value="in_progress" className="bg-gunmetal-900">In Progress</option>
                              <option value="resolved" className="bg-gunmetal-900">Resolved</option>
                              <option value="closed" className="bg-gunmetal-900">Closed</option>
                            </select>
                          </div>

                          <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <AlertCircle className="w-4 h-4 text-neon-pink" />
                              <span className="text-xs text-gray-400">Priority</span>
                            </div>
                            <p className={`text-sm font-medium ${getPriorityColor(bug.priority)}`}>
                              {bug.priority.toUpperCase()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        showPageNumbers={screenSize !== 'sm'}
        itemsPerPage={itemsPerPage}
        totalItems={filteredBugs.length}
        loading={loading}
        className="mt-6"
      />

      {/* New Bug Modal */}
      {showNewBugModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 w-full max-w-2xl border border-gunmetal-800"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Bug className="w-6 h-6 text-neon-raspberry" />
                <h2 className="text-xl font-bold gradient-text">Report Bug</h2>
              </div>
              <button
                onClick={() => setShowNewBugModal(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitBug} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
                  placeholder="Brief description of the bug"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  required
                  rows={4}
                  className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
                  placeholder="Detailed description of the bug, steps to reproduce, and expected behavior"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Priority
                </label>
                <select
                  name="priority"
                  required
                  className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewBugModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 bg-neon-raspberry text-white rounded-lg hover:bg-[#FF69B4] transition-all duration-300"
                >
                  <Check className="w-4 h-4" />
                  Submit Report
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

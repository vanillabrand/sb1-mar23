import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  StickyNote,
  Plus,
  Trash2,
  Save,
  X,
  Loader2,
  AlertCircle,
  Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logService } from '../lib/log-service';
import createDOMPurify from 'dompurify';
import { useAuth } from '../hooks/useAuth';
import { Pagination } from './ui/Pagination';

// Initialize DOMPurify
const DOMPurify = createDOMPurify(window);

interface Note {
  id: string;
  content: string;
  created_at: string;
}

export function Notes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [paginatedNotes, setPaginatedNotes] = useState<Note[]>([]);

  useEffect(() => {
    loadNotes();
  }, []);

  // Update paginated notes when notes, page, or items per page changes
  useEffect(() => {
    updatePaginatedNotes();
  }, [notes, currentPage, itemsPerPage]);

  // Function to update paginated notes
  const updatePaginatedNotes = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setPaginatedNotes(notes.slice(startIndex, endIndex));
  };

  const loadNotes = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('user_notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (err) {
      logService.log('error', 'Failed to load notes', err, 'Notes');
      setError('Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !user) return;

    try {
      setIsAdding(true);
      setError(null);

      // Sanitize content
      const sanitizedContent = DOMPurify.sanitize(newNote.trim());

      const { data, error } = await supabase
        .from('user_notes')
        .insert([{
          user_id: user.id,
          content: sanitizedContent
        }])
        .select()
        .single();

      if (error) throw error;

      setNotes([data, ...notes]);
      setNewNote('');
      setIsAdding(false);
    } catch (err) {
      logService.log('error', 'Failed to add note', err, 'Notes');
      setError('Failed to add note');
      setIsAdding(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      setIsDeleting(id);
      setError(null);

      const { error } = await supabase
        .from('user_notes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setNotes(notes.filter(note => note.id !== id));
    } catch (err) {
      logService.log('error', 'Failed to delete note', err, 'Notes');
      setError('Failed to delete note');
    } finally {
      setIsDeleting(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 text-neon-raspberry animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <StickyNote className="w-6 h-6 text-neon-yellow" />
          <h2 className="text-xl font-bold gradient-text">Quick Notes</h2>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Add Note Form */}
      <div className="mb-6">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Write a quick note..."
          className="w-full h-24 bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-yellow focus:border-transparent resize-none"
          maxLength={1000}
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-gray-400">
            {1000 - newNote.length} characters remaining
          </span>
          <button
            onClick={handleAddNote}
            disabled={isAdding || !newNote.trim()}
            className="flex items-center gap-1 px-3 py-1.5 bg-gunmetal-800 text-gray-300 rounded-lg hover:text-neon-yellow transition-all duration-300 disabled:opacity-50 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add +
          </button>
        </div>
      </div>

      {/* Notes List */}
      <div className="space-y-4">
        <AnimatePresence mode="sync">
          {paginatedNotes.map(note => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-gunmetal-800/50 rounded-lg p-4 border border-gunmetal-700"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <p className="text-gray-200 whitespace-pre-wrap break-words">
                    {note.content}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {formatDate(note.created_at)}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  disabled={isDeleting === note.id}
                  className="p-1 text-gray-400 hover:text-neon-pink transition-colors"
                >
                  {isDeleting === note.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {notes.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            No notes yet. Add your first note above.
          </div>
        )}

        {/* Pagination */}
        {notes.length > itemsPerPage && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(notes.length / itemsPerPage)}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={notes.length}
            showPageNumbers={true}
            showItemsPerPage={true}
            itemsPerPageOptions={[5, 10, 20]}
            onItemsPerPageChange={(newItemsPerPage) => {
              setItemsPerPage(newItemsPerPage);
              setCurrentPage(1); // Reset to first page when changing items per page
            }}
            className="mt-6"
          />
        )}
      </div>
    </div>
  );
}

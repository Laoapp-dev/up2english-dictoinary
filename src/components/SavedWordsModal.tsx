import React, { useState, useEffect } from 'react';
import { X, Bookmark, Search, Trash2, Brain } from 'lucide-react';
import { DictionaryEntry } from '../types';
import { getBookmarkedWords, toggleBookmarkInDB } from '../db/indexedDB';

interface SavedWordsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWord: (word: string) => void;
  onOpenQuiz?: () => void;
}

export const SavedWordsModal: React.FC<SavedWordsModalProps> = ({
  isOpen,
  onClose,
  onSelectWord,
  onOpenQuiz,
}) => {
  const [bookmarks, setBookmarks] = useState<DictionaryEntry[]>([]);
  const [filter, setFilter] = useState('');

  const loadBookmarks = async () => {
    try {
      const words = await getBookmarkedWords();
      setBookmarks(words);
    } catch {
      setBookmarks([]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBookmarks();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRemoveBookmark = async (word: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleBookmarkInDB(word);
    await loadBookmarks();
  };

  const filteredBookmarks = bookmarks.filter(
    item =>
      item.word.toLowerCase().includes(filter.toLowerCase()) ||
      item.meanings.some(m =>
        m.definitions.some(d => d.definition.toLowerCase().includes(filter.toLowerCase()))
      )
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
              <Bookmark className="w-5 h-5 fill-violet-600 dark:fill-violet-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Bookmarked Words ({bookmarks.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your saved vocabulary collection stored in IndexedDB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenQuiz && (
              <button
                onClick={() => {
                  onClose();
                  onOpenQuiz();
                }}
                className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Brain className="w-4 h-4" />
                <span className="hidden sm:inline">Start Quiz</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="my-4 relative flex-shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Search saved vocabulary..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* Word List */}
        <div className="flex-grow overflow-y-auto space-y-3 pr-1">
          {filteredBookmarks.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
              {filter
                ? `No bookmarked words match "${filter}".`
                : 'No bookmarked words yet. Click the bookmark icon on any word card to save it here.'}
            </div>
          ) : (
            filteredBookmarks.map(item => (
              <div
                key={item.word}
                onClick={() => {
                  onSelectWord(item.word);
                  onClose();
                }}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 hover:border-violet-400 transition-all flex items-start justify-between gap-4 cursor-pointer group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base text-slate-900 dark:text-slate-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 capitalize transition-colors">
                      {item.word}
                    </span>
                    {item.phonetic && (
                      <span className="text-xs font-serif italic text-slate-500">{item.phonetic}</span>
                    )}
                    <span className="text-[10px] px-2 py-0.5 rounded bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400 font-bold lowercase">
                      {item.meanings[0]?.partOfSpeech || 'word'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                    {item.meanings[0]?.definitions[0]?.definition}
                  </p>
                </div>

                <button
                  onClick={e => handleRemoveBookmark(item.word, e)}
                  title="Remove Bookmark"
                  className="p-2 rounded-lg text-violet-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-4.5 h-4.5" />
                </button>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};

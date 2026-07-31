import React, { useState, useEffect } from 'react';
import { X, History, Trash2, ArrowRight, Clock } from 'lucide-react';
import { SearchHistoryItem } from '../types';
import { getSearchHistory, clearSearchHistory } from '../db/indexedDB';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWord: (word: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  onSelectWord,
}) => {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);

  const loadHistory = async () => {
    try {
      const items = await getSearchHistory(50);
      setHistory(items);
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClear = async () => {
    if (confirm('Clear all search history?')) {
      await clearSearchHistory();
      await loadHistory();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Search History
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Recent dictionary lookups stored in IndexedDB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={handleClear}
                title="Clear Search History"
                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs font-semibold"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Clear All</span>
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

        {/* History Item List */}
        <div className="mt-4 flex-grow overflow-y-auto space-y-2 pr-1">
          {history.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
              No recent search history found.
            </div>
          ) : (
            history.map(item => (
              <button
                key={item.timestamp + item.word}
                onClick={() => {
                  onSelectWord(item.word);
                  onClose();
                }}
                className="w-full text-left p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 hover:bg-indigo-50/50 dark:hover:bg-slate-800 hover:border-indigo-400 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 capitalize">
                    {item.word}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500" />
                </div>
              </button>
            ))
          )}
        </div>

      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  FolderEdit, 
  BookOpen, 
  Volume2, 
  Tag 
} from 'lucide-react';
import { DictionaryEntry } from '../types';
import { getCustomWords, deleteWordFromDB } from '../db/indexedDB';
import { CustomWordModal } from './CustomWordModal';

interface CustomWordsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWord: (word: string) => void;
}

export const CustomWordsManager: React.FC<CustomWordsManagerProps> = ({
  isOpen,
  onClose,
  onSelectWord,
}) => {
  const [customWords, setCustomWords] = useState<DictionaryEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DictionaryEntry | null>(null);

  const loadWords = async () => {
    try {
      const words = await getCustomWords();
      setCustomWords(words);
    } catch {
      setCustomWords([]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadWords();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = async (word: string) => {
    if (confirm(`Are you sure you want to delete "${word}" from your custom dictionary?`)) {
      await deleteWordFromDB(word);
      await loadWords();
    }
  };

  const filteredWords = customWords.filter(
    item =>
      item.word.toLowerCase().includes(filter.toLowerCase()) ||
      item.meanings.some(m =>
        m.definitions.some(d => d.definition.toLowerCase().includes(filter.toLowerCase()))
      )
  );

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white dark:bg-zinc-800 rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-zinc-200 dark:border-zinc-700/80 max-h-[90vh] flex flex-col">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-700 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <FolderEdit className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Custom & Imported Vocabulary ({customWords.length})
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Manage user-created and imported dictionary entries stored in IndexedDB
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEditingEntry(null);
                  setIsAddModalOpen(true);
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl flex items-center gap-1 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" /> Add Word
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search Filter Bar */}
          <div className="my-4 relative flex-shrink-0">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter custom words..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          {/* Word List */}
          <div className="flex-grow overflow-y-auto space-y-3 pr-1">
            {filteredWords.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 dark:text-zinc-500 text-sm">
                {filter
                  ? `No custom words match "${filter}".`
                  : 'No custom words added yet. Click "+ Add Word" or use "Import Data" to upload a CSV/JSON file.'}
              </div>
            ) : (
              filteredWords.map(item => (
                <div
                  key={item.word}
                  className="p-4 rounded-2xl bg-zinc-50/80 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-zinc-700/60 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => {
                          onSelectWord(item.word);
                          onClose();
                        }}
                        className="font-bold text-base text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 capitalize transition-colors text-left"
                      >
                        {item.word}
                      </button>

                      {item.phonetic && (
                        <span className="text-xs font-mono text-indigo-500">{item.phonetic}</span>
                      )}

                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-semibold uppercase">
                        {item.meanings[0]?.partOfSpeech || 'custom'}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2">
                      {item.meanings[0]?.definitions[0]?.definition}
                    </p>

                    {item.meanings[0]?.definitions[0]?.example && (
                      <p className="text-[11px] italic text-zinc-400 line-clamp-1">
                        "{item.meanings[0]?.definitions[0]?.example}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingEntry(item);
                        setIsAddModalOpen(true);
                      }}
                      title="Edit Word"
                      className="p-2 rounded-xl text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.word)}
                      title="Delete Custom Word"
                      className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      </div>

      {/* Add / Edit Form Modal */}
      <CustomWordModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSaved={loadWords}
        initialEntry={editingEntry}
      />
    </>
  );
};

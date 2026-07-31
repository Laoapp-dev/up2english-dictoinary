import React, { useState, useEffect } from 'react';
import { X, Plus, Save } from 'lucide-react';
import { DictionaryEntry } from '../types';
import { convertRawInputToEntry } from '../utils/csvJsonParser';
import { saveWordToDB } from '../db/indexedDB';

interface CustomWordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialEntry?: DictionaryEntry | null;
}

export const CustomWordModal: React.FC<CustomWordModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialEntry,
}) => {
  const [word, setWord] = useState('');
  const [pronunciation, setPronunciation] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('noun');
  const [definition, setDefinition] = useState('');
  const [example, setExample] = useState('');
  const [synonyms, setSynonyms] = useState('');
  const [antonyms, setAntonyms] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialEntry) {
      setWord(initialEntry.word);
      setPronunciation(initialEntry.phonetic || '');
      setPartOfSpeech(initialEntry.meanings[0]?.partOfSpeech || 'noun');
      setDefinition(initialEntry.meanings[0]?.definitions[0]?.definition || '');
      setExample(initialEntry.meanings[0]?.definitions[0]?.example || '');
      setSynonyms(initialEntry.meanings[0]?.definitions[0]?.synonyms?.join(', ') || '');
      setAntonyms(initialEntry.meanings[0]?.definitions[0]?.antonyms?.join(', ') || '');
    } else {
      setWord('');
      setPronunciation('');
      setPartOfSpeech('noun');
      setDefinition('');
      setExample('');
      setSynonyms('');
      setAntonyms('');
    }
    setError('');
  }, [initialEntry, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!word.trim() || !definition.trim()) {
      setError('Word title and definition are required fields.');
      return;
    }

    const entry = convertRawInputToEntry({
      word,
      pronunciation,
      partofspeech: partOfSpeech,
      definition,
      sampleSentence: example,
      synonyms,
      antonyms,
    });

    if (!entry) {
      setError('Failed to construct word entry. Please check required inputs.');
      return;
    }

    try {
      await saveWordToDB(entry);
      onSaved();
      onClose();
    } catch (err) {
      setError(`Database save failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-zinc-200 dark:border-zinc-700/80 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
              <Plus className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {initialEntry ? 'Edit Custom Word' : 'Add Custom Word'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-300 font-medium">
              {error}
            </div>
          )}

          {/* Word & Phonetic */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Word Title *
              </label>
              <input
                type="text"
                required
                value={word}
                onChange={e => setWord(e.target.value)}
                placeholder="e.g. serendipity"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Pronunciation / IPA
              </label>
              <input
                type="text"
                value={pronunciation}
                onChange={e => setPronunciation(e.target.value)}
                placeholder="e.g. /ˌsɛrənˈdɪpɪti/"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
          </div>

          {/* Part of speech */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              Part of Speech
            </label>
            <select
              value={partOfSpeech}
              onChange={e => setPartOfSpeech(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            >
              <option value="noun">noun</option>
              <option value="verb">verb</option>
              <option value="adjective">adjective</option>
              <option value="adverb">adverb</option>
              <option value="pronoun">pronoun</option>
              <option value="preposition">preposition</option>
              <option value="conjunction">conjunction</option>
              <option value="interjection">interjection</option>
              <option value="other">other</option>
            </select>
          </div>

          {/* Definition */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              Definition *
            </label>
            <textarea
              required
              rows={3}
              value={definition}
              onChange={e => setDefinition(e.target.value)}
              placeholder="The occurrence and development of events by chance in a happy way."
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>

          {/* Example Sentence */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              Sample Sentence
            </label>
            <input
              type="text"
              value={example}
              onChange={e => setExample(e.target.value)}
              placeholder="Finding this dataset was pure serendipity."
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>

          {/* Synonyms & Antonyms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Synonyms (Comma-separated)
              </label>
              <input
                type="text"
                value={synonyms}
                onChange={e => setSynonyms(e.target.value)}
                placeholder="chance, fluke, fortuity"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Antonyms (Comma-separated)
              </label>
              <input
                type="text"
                value={antonyms}
                onChange={e => setAntonyms(e.target.value)}
                placeholder="misfortune, design"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Save className="w-4 h-4" />
              Save Word
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

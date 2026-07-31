import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Mic, MicOff, BookOpen, Clock, ArrowRight } from 'lucide-react';
import { DictionaryEntry, SearchHistoryItem } from '../types';
import { searchLocalWords, getSearchHistory } from '../db/indexedDB';

interface SearchBarProps {
  onSearch: (word: string) => void;
  isLoading: boolean;
  initialValue?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  isLoading,
  initialValue = '',
}) => {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<DictionaryEntry[]>([]);
  const [historyItems, setHistoryItems] = useState<SearchHistoryItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isListening, setIsListening] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Sync initial query
  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  // Load history on focus
  const loadHistory = async () => {
    try {
      const history = await getSearchHistory(5);
      setHistoryItems(history);
    } catch {
      setHistoryItems([]);
    }
  };

  // Fetch live local suggestions as query changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!query.trim()) {
        setSuggestions([]);
        return;
      }
      try {
        const results = await searchLocalWords(query, 6);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      }
    };

    const timer = setTimeout(fetchSuggestions, 150);
    return () => clearTimeout(timer);
  }, [query]);

  // Handle outside click to close overlay
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize Speech Recognition if available
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setQuery(transcript);
            onSearch(transcript);
            setIsOpen(false);
          }
          setIsListening(false);
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);

        recognitionRef.current = recognition;
      }
    }
  }, [onSearch]);

  const toggleVoiceSearch = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onSearch(query.trim());
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleSelectSuggestion = (word: string) => {
    setQuery(word);
    onSearch(word);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = suggestions.length + (query.trim() ? 0 : historyItems.length);
    if (!isOpen || totalItems === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < totalItems - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : totalItems - 1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      if (query.trim() && suggestions[selectedIndex]) {
        handleSelectSuggestion(suggestions[selectedIndex].word);
      } else if (!query.trim() && historyItems[selectedIndex]) {
        handleSelectSuggestion(historyItems[selectedIndex].word);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto my-4">
      <form onSubmit={handleFormSubmit} className="relative flex items-center group">
        
        {/* Search Input Icon */}
        <div className="absolute left-4 text-slate-400 group-focus-within:text-indigo-500 pointer-events-none transition-colors">
          <Search className="w-5 h-5" />
        </div>

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => {
            setIsOpen(true);
            loadHistory();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search for a word (e.g., 'Ephemeral', 'Luminous')..."
          className="block w-full pl-11 pr-28 py-3.5 bg-slate-100 dark:bg-slate-800 border border-transparent dark:border-slate-700/60 rounded-xl text-sm sm:text-base text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all focus:outline-none shadow-sm"
        />

        {/* Right Input Controls */}
        <div className="absolute right-3 flex items-center gap-1">
          {/* Clear Button */}
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSuggestions([]);
                inputRef.current?.focus();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Speech / Voice Input Button */}
          {typeof window !== 'undefined' &&
            ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) && (
              <button
                type="button"
                onClick={toggleVoiceSearch}
                title={isListening ? 'Stop Listening' : 'Search by Voice'}
                className={`p-2 rounded-lg transition-colors ${
                  isListening
                    ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400 animate-pulse'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}

          {/* Search Action Button */}
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium text-xs sm:text-sm flex items-center gap-1.5 shadow-sm transition-all ml-1"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span className="hidden sm:inline">Search</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Autocomplete & Recent History Overlay */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-40 transition-all">
          
          {/* Direct Matching Suggestions */}
          {query.trim() && suggestions.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Local Matches
              </div>
              {suggestions.map((item, idx) => (
                <button
                  key={item.word}
                  onClick={() => handleSelectSuggestion(item.word)}
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between text-sm hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors ${
                    selectedIndex === idx ? 'bg-indigo-50 dark:bg-slate-700/80 text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <BookOpen className="w-4 h-4 text-indigo-500" />
                    <span className="font-medium capitalize">
                      {item.word}
                    </span>
                    {item.phonetic && (
                      <span className="text-xs text-slate-400 font-serif italic">{item.phonetic}</span>
                    )}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 capitalize">
                    {item.source}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Search History Suggestions */}
          {!query.trim() && historyItems.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Recent Searches
              </div>
              {historyItems.map((item, idx) => (
                <button
                  key={item.timestamp + item.word}
                  onClick={() => handleSelectSuggestion(item.word)}
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between text-sm hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors ${
                    selectedIndex === idx ? 'bg-indigo-50 dark:bg-slate-700/80 text-indigo-700' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="font-medium capitalize">
                    {item.word}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(item.timestamp).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* No local match warning */}
          {query.trim() && suggestions.length === 0 && (
            <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <span>Press Enter or click Search for live API lookup for "<strong>{query}</strong>"</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

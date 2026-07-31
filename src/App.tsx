import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { WordCard } from './components/WordCard';
import { ImportExportModal } from './components/ImportExportModal';
import { CustomWordsManager } from './components/CustomWordsManager';
import { SavedWordsModal } from './components/SavedWordsModal';
import { HistoryModal } from './components/HistoryModal';
import { CustomWordModal } from './components/CustomWordModal';
import { QuizModal } from './components/QuizModal';
import { WordOfTheDayCard } from './components/WordOfTheDayCard';
import { lookupWord, FetchWordResult, generateExternalLinks } from './services/dictionaryApi';
import { 
  toggleBookmarkInDB, 
  getBookmarkedWords, 
  getDB, 
  getAllStoredWords, 
  getSearchHistory 
} from './db/indexedDB';
import { STARTER_WORDS } from './data/starterDictionary';
import { SearchHistoryItem } from './types';
import { 
  Plus, 
  ExternalLink, 
  WifiOff, 
  Search, 
  Upload, 
  Bookmark, 
  FolderEdit, 
  History, 
  Database,
  Sparkles,
  Brain,
  X,
  Sun,
  Moon
} from 'lucide-react';

export default function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('up2eng_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Network online/offline state
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // PWA install prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Dictionary lookup state
  const [currentWord, setCurrentWord] = useState('luminous');
  const [result, setResult] = useState<FetchWordResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [bookmarkedCount, setBookmarkedCount] = useState(0);
  const [totalDbWords, setTotalDbWords] = useState(0);
  const [recentHistory, setRecentHistory] = useState<SearchHistoryItem[]>([]);

  // Modal visibility states
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isCustomWordsOpen, setIsCustomWordsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAddWordOpen, setIsAddWordOpen] = useState(false);
  const [isQuizOpen, setIsQuizOpen] = useState(false);

  // Apply dark mode class to html element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('up2eng_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('up2eng_theme', 'light');
    }
  }, [darkMode]);

  // Listen to online / offline network events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Capture PWA install prompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Update counts & history sidebar data
  const refreshMetrics = useCallback(async () => {
    try {
      const bookmarks = await getBookmarkedWords();
      setBookmarkedCount(bookmarks.length);

      const allStored = await getAllStoredWords();
      setTotalDbWords(allStored.length);

      const history = await getSearchHistory(6);
      setRecentHistory(history);
    } catch {
      // Fallback
    }
  }, []);

  // Core Word Lookup Function
  const handleSearchWord = useCallback(
    async (wordToSearch: string, forceOnline: boolean = false) => {
      if (!wordToSearch.trim()) return;
      setIsLoading(true);
      setCurrentWord(wordToSearch);

      try {
        const res = await lookupWord(wordToSearch, {
          forceOnline,
          // Cached results are shown instantly; if the cache is stale, this fires
          // later with fresher data pulled from the network and silently syncs the
          // UI + IndexedDB without another loading spinner.
          onRevalidated: fresh => {
            setCurrentWord(current => {
              if (current.toLowerCase().trim() === wordToSearch.toLowerCase().trim()) {
                setResult(fresh);
              }
              return current;
            });
            refreshMetrics();
          },
        });
        setResult(res);
        await refreshMetrics();
      } catch {
        setResult({
          entry: null,
          fromCache: false,
          isOffline: !navigator.onLine,
          error: `Error searching for "${wordToSearch}".`,
          externalLinks: generateExternalLinks(wordToSearch),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [refreshMetrics]
  );

  // Initial Boot Lookup & DB warmup
  useEffect(() => {
    const initApp = async () => {
      await getDB(); // Initializes DB and warm starter dataset

      // Handle PWA manifest shortcuts (Home Screen long-press / right-click actions)
      const params = new URLSearchParams(window.location.search);
      const action = params.get('action');
      if (action === 'saved') {
        setIsBookmarksOpen(true);
      } else if (action === 'random') {
        await handleRandomWord();
        await refreshMetrics();
        return;
      }

      await handleSearchWord('luminous');
      await refreshMetrics();
    };
    initApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSearchWord, refreshMetrics]);

  // Handle Bookmark Toggle
  const handleBookmarkToggle = async (word: string) => {
    await toggleBookmarkInDB(word);
    if (result && result.entry) {
      setResult({
        ...result,
        entry: {
          ...result.entry,
          isBookmarked: !result.entry.isBookmarked,
        },
      });
    }
    await refreshMetrics();
  };

  // Random Word Trigger
  const handleRandomWord = async () => {
    try {
      const allWords = await getAllStoredWords();
      if (allWords.length > 0) {
        const randomItem = allWords[Math.floor(Math.random() * allWords.length)];
        handleSearchWord(randomItem.word);
      } else {
        const randomStarter = STARTER_WORDS[Math.floor(Math.random() * STARTER_WORDS.length)];
        handleSearchWord(randomStarter.word);
      }
    } catch {
      handleSearchWord('luminous');
    }
  };

  // Trigger PWA Install
  const handleInstallPWA = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => setDeferredPrompt(null));
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-violet-50/60 dark:from-slate-950 dark:via-slate-950 dark:to-violet-950/30 text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors selection:bg-violet-500 selection:text-white">
      
      {/* Top Header Navigation */}
      <Header
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        isOnline={isOnline}
        deferredPrompt={deferredPrompt}
        onInstallPWA={handleInstallPWA}
        onOpenImportExport={() => setIsImportExportOpen(true)}
        onOpenBookmarks={() => setIsBookmarksOpen(true)}
        onOpenCustomWords={() => setIsCustomWordsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenAddWord={() => setIsAddWordOpen(true)}
        onOpenQuiz={() => setIsQuizOpen(true)}
        onRandomWord={handleRandomWord}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        bookmarkedCount={bookmarkedCount}
      />

      {/* Slide-out Navigation Drawer Backdrop */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Slide-out Navigation Drawer */}
      <aside className={`fixed top-0 left-0 bottom-0 z-50 w-80 sm:w-88 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col p-6 overflow-y-auto shadow-2xl transition-transform duration-300 ease-in-out ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-xs">
              U
            </div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Sidebar Menu
            </h2>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Recent Searches */}
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4 flex items-center justify-between">
            <span>Recent Searches</span>
            <History className="w-3.5 h-3.5" />
          </h2>
          
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {recentHistory.length > 0 ? (
              recentHistory.map(item => {
                const isActive = item.word.toLowerCase() === currentWord.toLowerCase();
                return (
                  <div
                    key={item.timestamp + item.word}
                    onClick={() => {
                      handleSearchWord(item.word);
                      setIsSidebarOpen(false);
                    }}
                    className={`p-3 text-sm font-medium transition-all cursor-pointer flex items-center justify-between ${
                      isActive
                        ? 'bg-slate-50 dark:bg-slate-800 border-l-4 border-violet-500 text-violet-700 dark:text-violet-300 font-semibold rounded-r-lg shadow-xs'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300 rounded-lg'
                    }`}
                  >
                    <span className="capitalize">{item.word}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="p-3 text-xs text-slate-400 dark:text-slate-500 italic">
                No recent searches
              </div>
            )}
          </div>
        </div>

        {/* Library Tools */}
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">
            Library Tools
          </h2>
          <div className="space-y-2.5">
            
            <button
              onClick={() => {
                setIsImportExportOpen(true);
                setIsSidebarOpen(false);
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700 transition-colors group bg-white dark:bg-slate-900"
            >
              <div className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                <Upload className="w-4 h-4 text-slate-400 group-hover:text-violet-500 transition-colors" />
                Import / Export
              </div>
              <span className="text-[10px] bg-violet-50 dark:bg-violet-950/80 px-1.5 py-0.5 rounded font-bold text-violet-600 dark:text-violet-400">
                JSON/CSV
              </span>
            </button>

            <button
              onClick={() => {
                setIsQuizOpen(true);
                setIsSidebarOpen(false);
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-violet-200/80 dark:border-violet-900/60 bg-violet-50/40 dark:bg-violet-950/20 hover:bg-violet-50 dark:hover:bg-violet-950/40 transition-colors group"
            >
              <div className="flex items-center gap-3 text-sm font-semibold text-violet-700 dark:text-violet-300">
                <Brain className="w-4 h-4 text-violet-600 dark:text-violet-400 group-hover:scale-110 transition-transform" />
                Vocabulary Quiz
              </div>
              <span className="text-[10px] bg-violet-600 text-white px-2 py-0.5 rounded-full font-bold">
                Practice
              </span>
            </button>

            <button
              onClick={() => {
                setIsBookmarksOpen(true);
                setIsSidebarOpen(false);
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700 transition-colors bg-white dark:bg-slate-900"
            >
              <div className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                <Bookmark className="w-4 h-4 text-slate-400" />
                Saved Bookmarks
              </div>
              {bookmarkedCount > 0 && (
                <span className="text-[10px] bg-violet-600 text-white px-2 py-0.5 rounded-full font-bold">
                  {bookmarkedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setIsCustomWordsOpen(true);
                setIsSidebarOpen(false);
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700 transition-colors bg-white dark:bg-slate-900"
            >
              <div className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                <FolderEdit className="w-4 h-4 text-slate-400" />
                Custom Dictionary
              </div>
            </button>

            <button
              onClick={() => {
                setIsAddWordOpen(true);
                setIsSidebarOpen(false);
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-violet-200 dark:border-violet-900/60 bg-violet-50/50 dark:bg-violet-950/30 hover:bg-violet-50 transition-colors"
            >
              <div className="flex items-center gap-3 text-sm font-medium text-violet-700 dark:text-violet-300">
                <Plus className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                Add New Entry
              </div>
            </button>

          </div>
        </div>

        {/* Screen Theme Switcher */}
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">
            Display Mode
          </h2>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all bg-white dark:bg-slate-900 cursor-pointer"
          >
            <div className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
              {darkMode ? (
                <Moon className="w-4 h-4 text-violet-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
              <span>{darkMode ? 'Dark Theme' : 'Light Theme'}</span>
            </div>
            <div className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-300 flex items-center ${
              darkMode ? 'bg-violet-600 justify-end' : 'bg-slate-300 justify-start'
            }`}>
              <div className="w-5 h-5 rounded-full bg-white shadow-xs" />
            </div>
          </button>
        </div>

        {/* Bottom Offline Info Banner */}
        <div className="mt-auto p-4 bg-violet-50 dark:bg-violet-950/40 rounded-2xl border border-violet-100 dark:border-violet-900">
          <p className="text-xs text-violet-700 dark:text-violet-300 leading-relaxed font-medium">
            Up2Eng works fully offline. Cached words are saved directly to your device's IndexedDB.
          </p>
        </div>

      </aside>

      {/* Main Container: Word Lookup & Definition Display */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <main className="flex-1 p-4 sm:p-8 overflow-y-auto bg-transparent">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Search Bar Input */}
            <SearchBar
              onSearch={word => handleSearchWord(word)}
              isLoading={isLoading}
              initialValue={currentWord}
            />

            {/* Background sync indicator: shown instantly from cache while fresher data is fetched */}
            {result?.revalidating && (
              <div className="w-full max-w-3xl mx-auto -mt-2 flex items-center justify-center gap-1.5 text-[11px] font-medium text-violet-500 dark:text-violet-400">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                Syncing latest definitions in the background&hellip;
              </div>
            )}

            {/* Featured Word of the Day Section */}
            <WordOfTheDayCard onSelectWord={word => handleSearchWord(word)} />

            {/* Content Display */}
            {isLoading ? (
              <div className="w-full max-w-3xl mx-auto p-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center shadow-sm flex flex-col items-center justify-center gap-4">
                <div className="w-10 h-10 border-4 border-violet-600/30 border-t-violet-600 rounded-full animate-spin" />
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Fetching definition for "{currentWord}"...
                </p>
              </div>
            ) : result?.entry ? (
              <WordCard
                entry={result.entry}
                onBookmarkToggle={handleBookmarkToggle}
                onSelectWord={word => handleSearchWord(word)}
              />
            ) : result ? (
              /* Empty / Word Not Found Card matching exact uploaded design */
              <div className="w-full max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-2xl p-8 sm:p-10 shadow-sm border border-slate-200 dark:border-slate-800 text-center space-y-6">
                
                <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-500 dark:text-amber-400 flex items-center justify-center shadow-inner">
                  {!isOnline ? <WifiOff className="w-7 h-7" /> : <Search className="w-7 h-7" />}
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                    Definition Not Found for "{currentWord}"
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
                    {result.error || `No online definition found for "${currentWord}". You can add it as a custom word or search external web sources.`}
                  </p>
                </div>

                {/* Primary Action Button: Add to Custom Dictionary */}
                <div className="pt-2 flex justify-center">
                  <button
                    onClick={() => setIsAddWordOpen(true)}
                    className="px-6 py-3 bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white font-semibold rounded-2xl text-sm flex items-center gap-2.5 shadow-md shadow-violet-500/20 transition-all"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Add "{currentWord}" to Custom Dictionary</span>
                  </button>
                </div>

                {/* External Fallback Search Links */}
                {result.externalLinks && result.externalLinks.length > 0 && (
                  <div className="pt-8 border-t border-slate-100 dark:border-slate-800/80 text-left space-y-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Search Web & External Sources
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {result.externalLinks.map(link => (
                        <a
                          key={link.title}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 hover:bg-white dark:hover:bg-slate-800 hover:border-violet-400 dark:hover:border-violet-500 text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center justify-between transition-all group shadow-2xs"
                        >
                          <span className="group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">{link.title}</span>
                          <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ) : null}

          </div>
        </main>
      </div>

      {/* Bottom Status Bar Footer */}
      <footer className="h-8 bg-slate-800 dark:bg-slate-950 text-[10px] flex items-center px-6 justify-between text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0 border-t border-slate-700 dark:border-slate-800 font-mono">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5">
            <Database className="w-3 h-3 text-violet-400" /> Words in IndexedDB: {totalDbWords.toLocaleString()}
          </span>
          <span className="hidden sm:inline">Active Word: {currentWord}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" /> PWA v1.0 Ready
          </span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="hidden sm:inline">Storage: Offline Cache Active</span>
        </div>
      </footer>

      {/* Modals */}
      <ImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        onImportSuccess={() => {
          handleSearchWord(currentWord, true);
          refreshMetrics();
        }}
      />

      <CustomWordsManager
        isOpen={isCustomWordsOpen}
        onClose={() => setIsCustomWordsOpen(false)}
        onSelectWord={word => handleSearchWord(word)}
      />

      <SavedWordsModal
        isOpen={isBookmarksOpen}
        onClose={() => setIsBookmarksOpen(false)}
        onSelectWord={word => handleSearchWord(word)}
        onOpenQuiz={() => setIsQuizOpen(true)}
      />

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onSelectWord={word => handleSearchWord(word)}
      />

      <CustomWordModal
        isOpen={isAddWordOpen}
        onClose={() => setIsAddWordOpen(false)}
        onSaved={() => {
          handleSearchWord(currentWord);
          refreshMetrics();
        }}
      />

      <QuizModal
        isOpen={isQuizOpen}
        onClose={() => setIsQuizOpen(false)}
        onSelectWord={word => handleSearchWord(word)}
      />

    </div>
  );
}

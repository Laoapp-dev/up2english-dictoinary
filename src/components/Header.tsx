import React from 'react';
import { 
  Moon, 
  Sun, 
  Download, 
  Upload, 
  History, 
  Bookmark, 
  FolderEdit, 
  Wifi, 
  WifiOff, 
  Sparkles,
  Plus,
  Brain,
  Menu,
  PanelLeft
} from 'lucide-react';

interface HeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  isOnline: boolean;
  deferredPrompt: any; // PWA install prompt
  onInstallPWA: () => void;
  onOpenImportExport: () => void;
  onOpenBookmarks: () => void;
  onOpenCustomWords: () => void;
  onOpenHistory: () => void;
  onOpenAddWord: () => void;
  onOpenQuiz: () => void;
  onRandomWord: () => void;
  onToggleSidebar: () => void;
  bookmarkedCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  darkMode,
  onToggleDarkMode,
  isOnline,
  deferredPrompt,
  onInstallPWA,
  onOpenImportExport,
  onOpenBookmarks,
  onOpenCustomWords,
  onOpenHistory,
  onOpenAddWord,
  onOpenQuiz,
  onRandomWord,
  onToggleSidebar,
  bookmarkedCount,
}) => {
  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-8 shrink-0 shadow-sm sticky top-0 z-30 transition-colors">
      
      {/* Brand Logo & Sidebar Toggle */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onToggleSidebar}
          title="Toggle Sidebar Menu"
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 border border-slate-200/80 dark:border-slate-800"
        >
          <Menu className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-semibold hidden sm:inline text-slate-700 dark:text-slate-200">Menu</span>
        </button>

        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm">
          U
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
            Up2Eng<span className="text-indigo-600">.</span>
          </span>
        </div>
      </div>

      {/* Action Controls & Utilities */}
      <div className="flex items-center gap-2 sm:gap-4">
        
        {/* Online Mode Badge */}
        <div 
          title={isOnline ? 'Connected to internet. Live lookups active.' : 'Offline mode. Using local IndexedDB.'}
          className={`hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${
            isOnline
              ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/60'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
          {isOnline ? 'Online Mode' : 'Offline Mode'}
        </div>

        {/* Quick Action Icon Buttons */}
        <div className="flex items-center gap-1">
          
          <button
            onClick={onRandomWord}
            title="Discover Random Word"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-1 text-xs font-medium"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="hidden md:inline">Random</span>
          </button>

          <button
            onClick={onOpenQuiz}
            title="Vocabulary Quiz & Flashcards"
            className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg text-indigo-600 dark:text-indigo-400 transition-colors flex items-center gap-1 text-xs font-semibold"
          >
            <Brain className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Quiz</span>
          </button>

          <button
            onClick={onOpenBookmarks}
            title="Saved Words"
            className="relative p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
          >
            <Bookmark className="w-4.5 h-4.5" />
            {bookmarkedCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {bookmarkedCount > 99 ? '99+' : bookmarkedCount}
              </span>
            )}
          </button>

          <button
            onClick={onOpenCustomWords}
            title="Custom Vocabulary"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
          >
            <FolderEdit className="w-4.5 h-4.5" />
          </button>

          <button
            onClick={onOpenImportExport}
            title="Import / Export Dataset"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
          >
            <Upload className="w-4.5 h-4.5" />
          </button>

          <button
            onClick={onOpenHistory}
            title="Search History"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
          >
            <History className="w-4.5 h-4.5" />
          </button>

          <button
            onClick={onOpenAddWord}
            title="Add Custom Word"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
          >
            <Plus className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
          </button>

          {/* Dark / Light Toggle */}
          <button
            onClick={onToggleDarkMode}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
          >
            {darkMode ? <Sun className="w-4.5 h-4.5 text-amber-400" /> : <Moon className="w-4.5 h-4.5 text-slate-700" />}
          </button>
        </div>

        {/* Install App Button */}
        {deferredPrompt && (
          <button
            onClick={onInstallPWA}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Install App</span>
          </button>
        )}

      </div>
    </header>
  );
};


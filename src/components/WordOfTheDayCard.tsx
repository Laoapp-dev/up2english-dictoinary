import React, { useState, useEffect } from 'react';
import { Calendar, Volume2, Sparkles, Bookmark, ArrowRight, RefreshCw } from 'lucide-react';
import { DictionaryEntry } from '../types';
import { lookupWord } from '../services/dictionaryApi';
import { toggleBookmarkInDB } from '../db/indexedDB';

interface WordOfTheDayCardProps {
  onSelectWord: (word: string) => void;
}

const WOTD_WORDS = [
  'luminous',
  'serendipity',
  'ephemeral',
  'petrichor',
  'quintessence',
  'solitude',
  'resilience',
  'mellifluous',
  'halcyon',
  'sonder',
  'quixotic',
  'ineffable',
  'liminal',
  'panacea',
  'effervescent',
  'aurora',
  'zenith',
  'surreal',
  'nebulous',
  'catalyst'
];

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export const WordOfTheDayCard: React.FC<WordOfTheDayCardProps> = ({ onSelectWord }) => {
  const [wotdEntry, setWotdEntry] = useState<DictionaryEntry | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);

  const todayStr = getTodayString();

  const loadWordOfTheDay = async (forceRefresh: boolean = false) => {
    setIsLoading(true);
    try {
      const storageKey = `up2eng_wotd_${todayStr}`;
      const cachedRaw = localStorage.getItem(storageKey);

      if (cachedRaw && !forceRefresh) {
        const parsed = JSON.parse(cachedRaw);
        if (parsed && parsed.word) {
          setWotdEntry(parsed);
          setIsBookmarked(Boolean(parsed.isBookmarked));
          setIsLoading(false);
          return;
        }
      }

      // Pick word deterministically for today's date
      const hash = hashCode(todayStr + (forceRefresh ? Math.random() : ''));
      const wordIndex = Math.abs(hash) % WOTD_WORDS.length;
      const targetWord = WOTD_WORDS[wordIndex];

      const res = await lookupWord(targetWord);
      if (res.entry) {
        setWotdEntry(res.entry);
        setIsBookmarked(Boolean(res.entry.isBookmarked));
        localStorage.setItem(storageKey, JSON.stringify(res.entry));
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWordOfTheDay();
  }, []);

  const handlePlayAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!wotdEntry) return;

    const audioObj = wotdEntry.phonetics?.find(p => p.audio)?.audio;
    if (audioObj) {
      setIsPlayingAudio(true);
      const audio = new Audio(audioObj);
      audio.play().catch(() => {
        setIsPlayingAudio(false);
      });
      audio.onended = () => setIsPlayingAudio(false);
    } else if ('speechSynthesis' in window) {
      setIsPlayingAudio(true);
      const utterance = new SpeechSynthesisUtterance(wotdEntry.word);
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleToggleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!wotdEntry) return;
    const newStatus = await toggleBookmarkInDB(wotdEntry.word);
    setIsBookmarked(newStatus);
    setWotdEntry(prev => prev ? { ...prev, isBookmarked: newStatus } : null);
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-3xl mx-auto p-6 bg-gradient-to-r from-indigo-900/10 via-indigo-50/50 to-slate-50 dark:from-slate-900 dark:to-slate-900 rounded-2xl border border-indigo-100 dark:border-indigo-950/60 animate-pulse flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-indigo-200/60 dark:bg-indigo-900/60 rounded" />
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      </div>
    );
  }

  if (!wotdEntry) return null;

  const firstMeaning = wotdEntry.meanings[0];
  const firstDef = firstMeaning?.definitions[0];

  return (
    <div 
      onClick={() => onSelectWord(wotdEntry.word)}
      className="w-full max-w-3xl mx-auto bg-gradient-to-br from-indigo-50/90 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30 rounded-2xl p-6 sm:p-7 border border-indigo-200/80 dark:border-indigo-900/60 shadow-sm hover:border-indigo-400 dark:hover:border-indigo-700 transition-all cursor-pointer group relative overflow-hidden"
    >
      {/* Decorative background accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Card Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-xs font-bold flex items-center gap-1.5 shadow-xs">
            <Sparkles className="w-3.5 h-3.5" /> Word of the Day
          </span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={e => {
              e.stopPropagation();
              loadWordOfTheDay(true);
            }}
            title="Refresh Word of the Day"
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          
          <button
            onClick={handleToggleBookmark}
            title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Word'}
            className={`p-1.5 rounded-lg border transition-all ${
              isBookmarked
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700'
                : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-600 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-amber-500 text-amber-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-3">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white capitalize tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {wotdEntry.word}
          </h2>
          {wotdEntry.phonetic && (
            <span className="text-lg font-serif italic text-slate-500 dark:text-slate-400">
              {wotdEntry.phonetic}
            </span>
          )}
          {firstMeaning?.partOfSpeech && (
            <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold lowercase">
              {firstMeaning.partOfSpeech}
            </span>
          )}
        </div>

        <button
          onClick={handlePlayAudio}
          className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-semibold ${
            isPlayingAudio
              ? 'bg-indigo-600 text-white'
              : 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white'
          }`}
        >
          <Volume2 className="w-4 h-4" />
          <span>{isPlayingAudio ? 'Playing...' : 'Pronounce'}</span>
        </button>
      </div>

      {/* Definition Snippet */}
      {firstDef && (
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed">
          {firstDef.definition}
        </p>
      )}

      {/* Footer Link */}
      <div className="mt-3 flex items-center justify-end text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
        <span>Explore full entry & synonyms</span>
        <ArrowRight className="w-3.5 h-3.5 ml-1" />
      </div>
    </div>
  );
};

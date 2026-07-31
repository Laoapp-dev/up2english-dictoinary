import React, { useState } from 'react';
import { 
  Volume2, 
  Bookmark, 
  Share2, 
  Copy, 
  Check, 
  ExternalLink, 
  Database, 
  Globe, 
  FileText, 
  Tag, 
  Sparkles,
  ChevronDown,
  Layers,
  Search as SearchIcon,
  BookMarked
} from 'lucide-react';
import { DictionaryEntry, WordSource, SourceBlock, ProviderId } from '../types';
import { playAudioOrTTS } from '../utils/speech';

/** Small per-provider accent colors so each source is easy to tell apart at a glance. */
const PROVIDER_STYLES: Record<ProviderId, { chip: string; dot: string }> = {
  'merriam-webster': { chip: 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200/80 dark:border-red-800/50', dot: 'bg-red-500' },
  'free-dictionary': { chip: 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-800/50', dot: 'bg-sky-500' },
  wiktionary: { chip: 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/50', dot: 'bg-purple-500' },
  datamuse: { chip: 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200/80 dark:border-teal-800/50', dot: 'bg-teal-500' },
  wikipedia: { chip: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300/80 dark:border-slate-700', dot: 'bg-slate-500' },
  custom: { chip: 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border-violet-200/80 dark:border-violet-800/50', dot: 'bg-violet-500' },
  starter: { chip: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/50', dot: 'bg-amber-500' },
};

interface WordCardProps {
  entry: DictionaryEntry;
  onBookmarkToggle: (word: string) => void;
  onSelectWord: (word: string) => void;
}

export const WordCard: React.FC<WordCardProps> = ({
  entry,
  onBookmarkToggle,
  onSelectWord,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showMoreSources, setShowMoreSources] = useState(false);
  const [activeSourceTab, setActiveSourceTab] = useState<number>(0);

  // Determine available audio URL from API phonetics
  const audioUrl = entry.phonetics?.find(p => Boolean(p.audio && p.audio.trim()))?.audio;

  const handlePlayAudio = () => {
    playAudioOrTTS(audioUrl, entry.word, setIsPlayingAudio);
  };

  // Copy word definition to clipboard
  const handleCopyDefinition = () => {
    const textToCopy = `${entry.word.toUpperCase()} ${entry.phonetic || ''}\n\n` +
      entry.meanings.map(m => 
        `[${m.partOfSpeech}]\n` +
        m.definitions.map((d, i) => `${i + 1}. ${d.definition}${d.example ? `\n   Example: "${d.example}"` : ''}`).join('\n')
      ).join('\n\n');

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper for source badge icon & label
  const getSourceBadge = (source: WordSource) => {
    switch (source) {
      case 'api':
        return {
          label: 'FreeDictionary API',
          bg: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-800/60',
          icon: <Globe className="w-3.5 h-3.5" />
        };
      case 'merriam-webster':
        return {
          label: 'Merriam-Webster API',
          bg: 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200/80 dark:border-red-800/60',
          icon: <Globe className="w-3.5 h-3.5" />
        };
      case 'cached':
        return {
          label: 'Cached Local API',
          bg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60',
          icon: <Database className="w-3.5 h-3.5" />
        };
      case 'custom':
        return {
          label: 'Custom Dataset',
          bg: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/60',
          icon: <FileText className="w-3.5 h-3.5" />
        };
      case 'starter':
      default:
        return {
          label: 'Starter Offline Vocabulary',
          bg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60',
          icon: <Sparkles className="w-3.5 h-3.5" />
        };
    }
  };

  const sourceBadge = getSourceBadge(entry.source);

  return (
    <div className="w-full max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-10 shadow-sm border border-slate-200 dark:border-slate-800 transition-all">
      
      {/* Top Header Section: Word & Pronunciation */}
      <div className="flex items-start justify-between mb-8 pb-8 border-b border-slate-200 dark:border-slate-800 gap-4 flex-wrap">
        <div>
          {/* Word Label & Title */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
              Word
            </span>
          </div>
          <div className="flex items-center gap-4 mb-3">
            <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight capitalize">
              {entry.word}
            </h1>
            
            {/* Pronunciation Audio Button */}
            <button
              onClick={handlePlayAudio}
              disabled={isPlayingAudio}
              title="Play Audio Pronunciation"
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-sm shrink-0 ${
                isPlayingAudio
                  ? 'bg-violet-600 text-white scale-95'
                  : 'bg-violet-100 dark:bg-violet-900/60 text-violet-600 dark:text-violet-400 hover:bg-violet-600 hover:text-white'
              }`}
            >
              <Volume2 className={`w-6 h-6 ${isPlayingAudio ? 'animate-pulse' : ''}`} />
            </button>
          </div>

          {/* Pronunciation Label & Text */}
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Pronunciation:
            </span>
            <span className="text-xl font-serif italic text-violet-700 dark:text-violet-300 font-medium">
              {entry.phonetic || (entry.phonetics && entry.phonetics.find(p => p.text)?.text) || `/${entry.word}/`}
            </span>
          </div>
        </div>

        {/* Source & Actions */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">
              {entry.sources && entry.sources.length > 1 ? 'Sources' : 'Source'}
            </span>
            {entry.sources && entry.sources.length > 1 ? (
              <div className="flex flex-wrap justify-end gap-1.5">
                {entry.sources.map(src => (
                  <span
                    key={src.provider}
                    className={`text-xs font-medium px-2.5 py-1 rounded-lg border shadow-sm flex items-center gap-1.5 ${PROVIDER_STYLES[src.provider]?.chip || sourceBadge.bg}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${PROVIDER_STYLES[src.provider]?.dot || 'bg-slate-400'}`} />
                    {src.label}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300 px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                {sourceBadge.label}
              </span>
            )}
          </div>

          {/* Bookmark Button */}
          <button
            onClick={() => onBookmarkToggle(entry.word)}
            title={entry.isBookmarked ? 'Remove from Saved Words' : 'Save to Bookmarks'}
            className={`p-2.5 rounded-lg border transition-all ${
              entry.isBookmarked
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Bookmark className={`w-5 h-5 ${entry.isBookmarked ? 'fill-amber-500 text-amber-500' : ''}`} />
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopyDefinition}
            title="Copy Definition Text"
            className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-700 transition-all"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Categorized Meanings (Definition, Sample Sentences, Synonyms, Antonyms) */}
      <div className="space-y-12">
        {entry.meanings.map((meaning, index) => {
          // Gather combined synonyms & antonyms for this meaning section
          const allSynonyms = Array.from(new Set([
            ...(meaning.synonyms || []),
            ...meaning.definitions.flatMap(d => d.synonyms || [])
          ])).filter(Boolean);

          const allAntonyms = Array.from(new Set([
            ...(meaning.antonyms || []),
            ...meaning.definitions.flatMap(d => d.antonyms || [])
          ])).filter(Boolean);

          return (
            <section key={meaning.partOfSpeech + index} className="space-y-6">
              
              {/* Part of speech header */}
              <div className="flex items-center gap-4 mb-4">
                <span className="px-3.5 py-1 bg-violet-600 text-white rounded-lg font-bold text-xs tracking-wide uppercase">
                  {meaning.partOfSpeech}
                </span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              </div>

              {/* Definitions List */}
              <div className="space-y-6">
                {meaning.definitions.map((defItem, dIdx) => (
                  <div key={dIdx} className="flex gap-4 sm:gap-6 group">
                    <span className="text-slate-300 dark:text-slate-600 font-serif text-2xl font-bold shrink-0">
                      {String(dIdx + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1 space-y-3">
                      
                      {/* Definition text */}
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                          Definition
                        </span>
                        <p className="text-lg text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                          {defItem.definition}
                        </p>
                      </div>

                      {/* Sample Sentences */}
                      {defItem.example && (
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 block mb-1">
                            Sample Sentence
                          </span>
                          <p className="text-slate-700 dark:text-slate-300 italic font-serif text-base leading-relaxed">
                            "{defItem.example}"
                          </p>
                        </div>
                      )}

                    </div>
                  </div>
                ))}
              </div>

              {/* Synonyms & Antonyms for this meaning */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-100 dark:border-slate-800/80">
                
                {/* Synonyms section */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-violet-500" />
                    Synonyms
                  </h3>
                  {allSynonyms.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {allSynonyms.map(syn => (
                        <button
                          key={syn}
                          onClick={() => onSelectWord(syn)}
                          className="px-3 py-1 bg-violet-50 dark:bg-violet-950/60 border border-violet-200/70 dark:border-violet-800/50 rounded-lg text-xs font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/80 transition-all cursor-pointer"
                        >
                          {syn}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 dark:text-slate-600 italic">No direct synonyms listed</p>
                  )}
                </div>

                {/* Antonyms section */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-rose-500" />
                    Antonyms
                  </h3>
                  {allAntonyms.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {allAntonyms.map(ant => (
                        <button
                          key={ant}
                          onClick={() => onSelectWord(ant)}
                          className="px-3 py-1 bg-rose-50 dark:bg-rose-950/60 border border-rose-200/70 dark:border-rose-800/50 rounded-lg text-xs font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/80 transition-all cursor-pointer"
                        >
                          {ant}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 dark:text-slate-600 italic">No direct antonyms listed</p>
                  )}
                </div>

              </div>

            </section>
          );
        })}
      </div>

      {/* More Options: Definitions & Sample Sentences by Source */}
      {entry.sources && entry.sources.length > 0 && (
        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setShowMoreSources(prev => !prev)}
            className="w-full flex items-center justify-between gap-3 group"
          >
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-violet-500" />
              More Options &mdash; Definitions by Source ({entry.sources.length})
            </h3>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform group-hover:text-violet-500 ${showMoreSources ? 'rotate-180' : ''}`}
            />
          </button>

          {showMoreSources && (
            <div className="mt-4 space-y-4">
              {/* Provider tabs */}
              {entry.sources.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {entry.sources.map((src, i) => (
                    <button
                      key={src.provider}
                      onClick={() => setActiveSourceTab(i)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                        activeSourceTab === i
                          ? PROVIDER_STYLES[src.provider]?.chip || 'bg-violet-50 text-violet-700 border-violet-200'
                          : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${PROVIDER_STYLES[src.provider]?.dot || 'bg-slate-400'}`} />
                      {src.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Active source panel */}
              {entry.sources[activeSourceTab] && (
                <div className="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border inline-flex items-center gap-1.5 ${PROVIDER_STYLES[entry.sources[activeSourceTab].provider]?.chip}`}>
                      <BookMarked className="w-3.5 h-3.5" />
                      {entry.sources[activeSourceTab].label}
                    </span>
                    {entry.sources[activeSourceTab].phonetic && (
                      <span className="text-sm font-serif italic text-slate-500 dark:text-slate-400">
                        {entry.sources[activeSourceTab].phonetic}
                      </span>
                    )}
                  </div>

                  {entry.sources[activeSourceTab].meanings.map((m, mi) => (
                    <div key={mi} className="space-y-2">
                      <span className="inline-block px-2.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-[11px] font-bold uppercase tracking-wide">
                        {m.partOfSpeech}
                      </span>
                      <ol className="space-y-2.5 list-decimal list-inside">
                        {m.definitions.map((d, di) => (
                          <li key={di} className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                            {d.definition}
                            {d.example && (
                              <div className="mt-1 ml-4 text-slate-500 dark:text-slate-400 italic font-serif text-sm">
                                &ldquo;{d.example}&rdquo;
                              </div>
                            )}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* External Sources */}
      <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800">
        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <SearchIcon className="w-3.5 h-3.5" />
          Look Up on the Web
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`https://www.google.com/search?q=define+${encodeURIComponent(entry.word)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            Google Search <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href={`https://en.wiktionary.org/wiki/${encodeURIComponent(entry.word)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            Wikimedia (Wiktionary) <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href={`https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(entry.word)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            Cambridge Dictionary <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href={`https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(entry.word)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            Oxford Dictionary <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href={`https://www.merriam-webster.com/dictionary/${encodeURIComponent(entry.word)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            Merriam-Webster <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

    </div>
  );
};

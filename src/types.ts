/**
 * Normalized Dictionary Data Types
 */

export type WordSource = 'api' | 'merriam-webster' | 'cached' | 'custom' | 'starter';

/** Identifiers for every provider that can contribute a source block to an entry. */
export type ProviderId =
  | 'merriam-webster'
  | 'free-dictionary'
  | 'wiktionary'
  | 'datamuse'
  | 'wikipedia'
  | 'custom'
  | 'starter';

export interface Phonetic {
  text?: string;
  audio?: string;
}

export interface DefinitionItem {
  definition: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

export interface Meaning {
  partOfSpeech: string;
  definitions: DefinitionItem[];
  synonyms?: string[];
  antonyms?: string[];
}

/**
 * A single provider's contribution to a word (e.g. what Merriam-Webster said,
 * separately from what Free Dictionary API said). Used to render "more options"
 * / per-source definitions & sample sentences on the Word Card, and lets the app
 * show every source that answered instead of only the first one that succeeded.
 */
export interface SourceBlock {
  provider: ProviderId;
  label: string;
  phonetic?: string;
  audio?: string;
  meanings: Meaning[];
  fetchedAt: number;
}

export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics?: Phonetic[];
  meanings: Meaning[];
  /** Per-provider breakdown of definitions/examples, when more than one source answered. */
  sources?: SourceBlock[];
  origin?: string;
  source: WordSource;
  isBookmarked?: boolean;
  createdAt?: number;
  updatedAt?: number;
  notes?: string;
}

export interface SearchHistoryItem {
  id?: number;
  word: string;
  timestamp: number;
}

export interface RawCustomWordInput {
  word: string;
  pronunciation?: string;
  phonetic?: string;
  partofspeech?: string;
  partOfSpeech?: string;
  pos?: string;
  definition: string;
  definitions?: string | string[];
  sampleSentence?: string;
  sample_sentence?: string;
  example?: string;
  synonym?: string | string[];
  synonyms?: string | string[];
  antonym?: string | string[];
  antonyms?: string | string[];
}

export interface ImportSummary {
  total: number;
  success: number;
  duplicates: number;
  errors: string[];
}

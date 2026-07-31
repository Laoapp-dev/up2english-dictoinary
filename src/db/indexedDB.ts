import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { DictionaryEntry, SearchHistoryItem } from '../types';
import { STARTER_WORDS } from '../data/starterDictionary';

interface LexiconDBSchema extends DBSchema {
  dictionary: {
    key: string; // word (lowercased)
    value: DictionaryEntry;
    indexes: {
      'by-word': string;
      'by-source': string;
      'by-bookmarked': number;
      'by-updated': number;
    };
  };
  history: {
    key: number;
    value: SearchHistoryItem;
    indexes: {
      'by-timestamp': number;
      'by-word': string;
    };
  };
}

const DB_NAME = 'LexiconDictionaryDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<LexiconDBSchema>> | null = null;

export async function getDB(): Promise<IDBPDatabase<LexiconDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<LexiconDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create dictionary store
        if (!db.objectStoreNames.contains('dictionary')) {
          const dictStore = db.createObjectStore('dictionary', { keyPath: 'word' });
          dictStore.createIndex('by-word', 'word');
          dictStore.createIndex('by-source', 'source');
          dictStore.createIndex('by-bookmarked', 'isBookmarked');
          dictStore.createIndex('by-updated', 'updatedAt');
        }

        // Create history store
        if (!db.objectStoreNames.contains('history')) {
          const historyStore = db.createObjectStore('history', {
            keyPath: 'id',
            autoIncrement: true,
          });
          historyStore.createIndex('by-timestamp', 'timestamp');
          historyStore.createIndex('by-word', 'word');
        }
      },
    });
  }

  const db = await dbPromise;

  // Check if initial starter dictionary is loaded
  const count = await db.count('dictionary');
  if (count === 0) {
    const tx = db.transaction('dictionary', 'readwrite');
    const store = tx.objectStore('dictionary');
    const now = Date.now();
    for (const item of STARTER_WORDS) {
      await store.put({
        ...item,
        word: item.word.toLowerCase().trim(),
        createdAt: now,
        updatedAt: now,
      });
    }
    await tx.done;
  }

  return db;
}

/**
 * Get exact word entry from IndexedDB
 */
export async function getWordFromDB(word: string): Promise<DictionaryEntry | null> {
  const db = await getDB();
  const normalized = word.toLowerCase().trim();
  const result = await db.get('dictionary', normalized);
  return result || null;
}

/**
 * Save single word entry to IndexedDB
 */
export async function saveWordToDB(entry: DictionaryEntry): Promise<void> {
  const db = await getDB();
  const normalizedWord = entry.word.toLowerCase().trim();
  const existing = await db.get('dictionary', normalizedWord);
  const now = Date.now();

  const toSave: DictionaryEntry = {
    ...entry,
    word: normalizedWord,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    isBookmarked: existing?.isBookmarked ?? entry.isBookmarked ?? false,
  };

  await db.put('dictionary', toSave);
}

/**
 * Delete word entry
 */
export async function deleteWordFromDB(word: string): Promise<void> {
  const db = await getDB();
  await db.delete('dictionary', word.toLowerCase().trim());
}

/**
 * Toggle Bookmark state for a word
 */
export async function toggleBookmarkInDB(word: string): Promise<boolean> {
  const db = await getDB();
  const normalized = word.toLowerCase().trim();
  const existing = await db.get('dictionary', normalized);
  if (!existing) return false;

  const newStatus = !existing.isBookmarked;
  existing.isBookmarked = newStatus;
  existing.updatedAt = Date.now();
  await db.put('dictionary', existing);
  return newStatus;
}

import Fuse from 'fuse.js';

/**
 * Search local database words using exact prefix matching and Fuse.js fuzzy matching
 */
export async function searchLocalWords(
  query: string,
  limit: number = 10
): Promise<DictionaryEntry[]> {
  const db = await getDB();
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const allWords = await db.getAll('dictionary');

  // Exact & Prefix matches first
  const prefixMatches = allWords.filter(item => {
    const w = item.word.toLowerCase();
    return w === q || w.startsWith(q);
  });

  // Fuse.js fuzzy search setup
  const fuse = new Fuse(allWords, {
    keys: [
      { name: 'word', weight: 0.6 },
      { name: 'meanings.definitions.definition', weight: 0.2 },
      { name: 'meanings.synonyms', weight: 0.1 },
      { name: 'phonetic', weight: 0.1 },
    ],
    threshold: 0.45,
    ignoreLocation: true,
  });

  const fuseResults = fuse.search(q).map(res => res.item);

  // Combine prefix matches and fuzzy matches without duplicates
  const resultMap = new Map<string, DictionaryEntry>();

  prefixMatches.sort((a, b) => a.word.localeCompare(b.word));
  for (const item of prefixMatches) {
    resultMap.set(item.word.toLowerCase(), item);
  }

  for (const item of fuseResults) {
    if (!resultMap.has(item.word.toLowerCase())) {
      resultMap.set(item.word.toLowerCase(), item);
    }
  }

  return Array.from(resultMap.values()).slice(0, limit);
}

/**
 * Find closest fuzzy matching word from IndexedDB when exact match fails
 */
export async function fuzzyFindWordFromDB(query: string): Promise<DictionaryEntry | null> {
  const db = await getDB();
  const q = query.toLowerCase().trim();
  if (!q) return null;

  const allWords = await db.getAll('dictionary');
  if (allWords.length === 0) return null;

  const fuse = new Fuse(allWords, {
    keys: ['word'],
    threshold: 0.4,
    includeScore: true,
  });

  const results = fuse.search(q);
  if (results.length > 0 && results[0].score !== undefined && results[0].score < 0.4) {
    return results[0].item;
  }

  return null;
}

/**
 * Bulk insert imported custom/dataset words
 */
export async function bulkInsertWordsToDB(
  entries: DictionaryEntry[]
): Promise<{ added: number; updated: number }> {
  const db = await getDB();
  const tx = db.transaction('dictionary', 'readwrite');
  const store = tx.objectStore('dictionary');

  let added = 0;
  let updated = 0;
  const now = Date.now();

  for (const entry of entries) {
    const normalized = entry.word.toLowerCase().trim();
    if (!normalized) continue;

    const existing = await store.get(normalized);
    if (existing) {
      updated++;
    } else {
      added++;
    }

    await store.put({
      ...entry,
      word: normalized,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      isBookmarked: existing?.isBookmarked ?? entry.isBookmarked ?? false,
    });
  }

  await tx.done;
  return { added, updated };
}

/**
 * Get all bookmarked words
 */
export async function getBookmarkedWords(): Promise<DictionaryEntry[]> {
  const db = await getDB();
  const all = await db.getAll('dictionary');
  return all
    .filter(item => Boolean(item.isBookmarked))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * Get all custom/user-added words
 */
export async function getCustomWords(): Promise<DictionaryEntry[]> {
  const db = await getDB();
  const all = await db.getAll('dictionary');
  return all
    .filter(item => item.source === 'custom')
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * Get all words stored in DB (for exporting)
 */
export async function getAllStoredWords(): Promise<DictionaryEntry[]> {
  const db = await getDB();
  return db.getAll('dictionary');
}

/**
 * Search history methods
 */
export async function addSearchHistory(word: string): Promise<void> {
  const db = await getDB();
  const normalized = word.toLowerCase().trim();
  if (!normalized) return;

  const now = Date.now();
  // Delete existing entry for same word if exists to avoid duplicates
  const allHistory = await db.getAll('history');
  const existing = allHistory.find(h => h.word.toLowerCase() === normalized);

  const tx = db.transaction('history', 'readwrite');
  const store = tx.objectStore('history');

  if (existing && existing.id) {
    await store.delete(existing.id);
  }

  await store.add({
    word: normalized,
    timestamp: now,
  });

  await tx.done;
}

export async function getSearchHistory(limit: number = 20): Promise<SearchHistoryItem[]> {
  const db = await getDB();
  const all = await db.getAll('history');
  return all
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

export async function clearSearchHistory(): Promise<void> {
  const db = await getDB();
  await db.clear('history');
}

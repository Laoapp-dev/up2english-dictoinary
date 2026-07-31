import { DictionaryEntry, Meaning, Phonetic, DefinitionItem, SourceBlock, ProviderId } from '../types';
import { getWordFromDB, saveWordToDB, addSearchHistory, fuzzyFindWordFromDB } from '../db/indexedDB';

interface RawFreeDictPhonetic {
  text?: string;
  audio?: string;
}

interface RawFreeDictDefinition {
  definition: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

interface RawFreeDictMeaning {
  partOfSpeech: string;
  definitions: RawFreeDictDefinition[];
  synonyms?: string[];
  antonyms?: string[];
}

interface RawFreeDictEntry {
  word: string;
  phonetic?: string;
  phonetics?: RawFreeDictPhonetic[];
  meanings: RawFreeDictMeaning[];
  origin?: string;
}

export interface FetchWordResult {
  entry: DictionaryEntry | null;
  fromCache: boolean;
  isOffline: boolean;
  error?: string;
  externalLinks?: { title: string; url: string }[];
  /** True while a background network refresh is still running after cached data was returned instantly. */
  revalidating?: boolean;
}

/** Options for lookupWord. `onRevalidated` fires once a background network refresh
 *  (triggered after instantly returning cached data) finishes with fresher data. */
export interface LookupOptions {
  forceOnline?: boolean;
  onRevalidated?: (result: FetchWordResult) => void;
}

const PROVIDER_LABELS: Record<ProviderId, string> = {
  'merriam-webster': 'Merriam-Webster',
  'free-dictionary': 'Free Dictionary API',
  wiktionary: 'Wiktionary',
  datamuse: 'Datamuse',
  wikipedia: 'Wikipedia',
  custom: 'Custom Dataset',
  starter: 'Starter Offline Vocabulary',
};

/** How long a cached entry is considered "fresh enough" to skip a background refetch (ms). */
const CACHE_FRESH_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours
/** Per-provider network timeout so one slow API never blocks the whole lookup. */
const PROVIDER_TIMEOUT_MS = 6000;

/** fetch() with an AbortController-based timeout so a hanging API can't stall the lookup. */
async function fetchWithTimeout(url: string, timeoutMs: number = PROVIDER_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Normalizes raw Free Dictionary API output into clean DictionaryEntry
 */
function normalizeFreeDictEntry(raw: RawFreeDictEntry): DictionaryEntry {
  const word = raw.word.toLowerCase().trim();

  // Find phonetic audio
  const phonetics: Phonetic[] = (raw.phonetics || [])
    .filter(p => Boolean(p.text || p.audio))
    .map(p => ({
      text: p.text,
      audio: p.audio,
    }));

  const displayPhonetic =
    raw.phonetic ||
    phonetics.find(p => p.text)?.text ||
    '';

  const meanings: Meaning[] = (raw.meanings || []).map(m => {
    const definitions: DefinitionItem[] = (m.definitions || []).map(d => ({
      definition: d.definition,
      example: d.example,
      synonyms: d.synonyms,
      antonyms: d.antonyms,
    }));

    return {
      partOfSpeech: m.partOfSpeech || 'general',
      definitions,
      synonyms: m.synonyms,
      antonyms: m.antonyms,
    };
  });

  return {
    word,
    phonetic: displayPhonetic,
    phonetics,
    meanings,
    source: 'api',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Merriam-Webster API keys (injected at build time via Vite from GitHub Actions secrets).
// NOTE: Because this app is a static site with no backend, any key baked into the
// build is visible to anyone who inspects the deployed JS bundle. Treat these as
// low-privilege, rate-limited keys (Merriam-Webster's free developer tier), not secrets
// that guard sensitive data.
const MW_DICT_KEY = import.meta.env.VITE_MW_DICT_KEY;
const MW_THESAURUS_KEY = import.meta.env.VITE_MW_THESAURUS_KEY;

function isMwKeyConfigured(key: string | undefined): boolean {
  return Boolean(key && key.trim() && !key.includes('YOUR_'));
}

interface MWSoundRef {
  audio?: string;
}
interface MWPronunciation {
  mw?: string;
  sound?: MWSoundRef;
}
interface MWHeadwordInfo {
  hw?: string;
  prs?: MWPronunciation[];
}
interface MWEntry {
  meta?: { id?: string; syns?: string[][]; ants?: string[][] };
  hwi?: MWHeadwordInfo;
  fl?: string;
  shortdef?: string[];
  def?: Array<{ sseq?: any[] }>;
}

/** Builds the Merriam-Webster pronunciation audio URL from an audio filename. */
function buildMWAudioUrl(filename: string): string {
  let subdir: string;
  if (filename.startsWith('bix')) subdir = 'bix';
  else if (filename.startsWith('gg')) subdir = 'gg';
  else if (/^[0-9\W]/.test(filename)) subdir = 'number';
  else subdir = filename[0];
  return `https://media.merriam-webster.com/audio/prons/en/us/mp3/${subdir}/${filename}.mp3`;
}

/**
 * Extracts illustrative example sentences ("verbal illustrations") embedded inside
 * Merriam-Webster's `def[].sseq` structure. MW nests these deeply, tagged `vis`.
 */
function extractMwExamples(entry: MWEntry): string[] {
  const examples: string[] = [];
  const stripMwMarkup = (s: string) => s.replace(/\{[^}]*\}/g, '').trim();

  try {
    for (const defBlock of entry.def || []) {
      for (const senseSeq of defBlock.sseq || []) {
        for (const senseItem of senseSeq) {
          const sense = senseItem?.[1];
          const dt = sense?.dt;
          if (!Array.isArray(dt)) continue;
          for (const [dtType, dtVal] of dt) {
            if (dtType === 'vis' && Array.isArray(dtVal)) {
              for (const visItem of dtVal) {
                if (visItem?.t) examples.push(stripMwMarkup(visItem.t));
              }
            }
          }
        }
      }
    }
  } catch {
    // MW's dt/sseq shape is notoriously deep & inconsistent; fail silently.
  }
  return examples;
}

/**
 * Merriam-Webster Collegiate Dictionary + Thesaurus API source block.
 * Requires VITE_MW_DICT_KEY (and optionally VITE_MW_THESAURUS_KEY for synonyms/antonyms).
 * Returns null silently if keys are not configured, the word isn't found, or the request fails,
 * so the app gracefully falls through to the other free sources.
 */
async function fetchMerriamWebster(word: string): Promise<SourceBlock | null> {
  if (!isMwKeyConfigured(MW_DICT_KEY)) return null;

  try {
    const res = await fetchWithTimeout(
      `https://www.dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(word)}?key=${MW_DICT_KEY}`
    );
    if (!res.ok) return null;

    const data: (MWEntry | string)[] = await res.json();
    // MW returns an array of suggestion strings (not objects) when the word isn't found
    if (!Array.isArray(data) || data.length === 0 || typeof data[0] === 'string') return null;

    const entries = data as MWEntry[];

    // Only keep entries that actually match the searched headword (MW sometimes
    // returns related entries like "run away" when you search "run").
    const normalizedWord = word.toLowerCase().trim();
    const matching = entries.filter(e => {
      const id = (e.meta?.id || '').toLowerCase().split(':')[0];
      const hw = (e.hwi?.hw || '').replace(/\*/g, '').toLowerCase();
      return id === normalizedWord || hw === normalizedWord;
    });
    const relevant = matching.length > 0 ? matching : entries;

    // Group definitions by part of speech
    const meaningsMap = new Map<string, DefinitionItem[]>();
    let audio: string | undefined;
    let phoneticText: string | undefined;

    for (const entry of relevant) {
      const pos = entry.fl || 'general';
      if (!meaningsMap.has(pos)) meaningsMap.set(pos, []);
      const examples = extractMwExamples(entry);
      const defs = entry.shortdef || [];
      defs.forEach((def, i) => {
        meaningsMap.get(pos)!.push({ definition: def, example: examples[i] });
      });

      if (!audio || !phoneticText) {
        const pr = entry.hwi?.prs?.find(p => p.sound?.audio || p.mw);
        if (pr) {
          if (!audio && pr.sound?.audio) audio = buildMWAudioUrl(pr.sound.audio);
          if (!phoneticText && pr.mw) phoneticText = pr.mw;
        }
      }
    }

    if (meaningsMap.size === 0) return null;

    const meanings: Meaning[] = Array.from(meaningsMap.entries()).map(([partOfSpeech, definitions]) => ({
      partOfSpeech,
      definitions,
    }));

    // Optionally enrich with the Thesaurus API for synonyms/antonyms
    if (isMwKeyConfigured(MW_THESAURUS_KEY)) {
      try {
        const thesRes = await fetchWithTimeout(
          `https://www.dictionaryapi.com/api/v3/references/thesaurus/json/${encodeURIComponent(word)}?key=${MW_THESAURUS_KEY}`
        );
        if (thesRes.ok) {
          const thesData: (MWEntry | string)[] = await thesRes.json();
          if (Array.isArray(thesData) && thesData.length > 0 && typeof thesData[0] !== 'string') {
            const thesEntry = (thesData as MWEntry[])[0];
            const synonyms = thesEntry.meta?.syns?.[0];
            const antonyms = thesEntry.meta?.ants?.[0];
            if ((synonyms && synonyms.length > 0) || (antonyms && antonyms.length > 0)) {
              meanings[0] = { ...meanings[0], synonyms, antonyms };
            }
          }
        }
      } catch {
        // Thesaurus enrichment is optional; fail silently
      }
    }

    return {
      provider: 'merriam-webster',
      label: PROVIDER_LABELS['merriam-webster'],
      phonetic: phoneticText ? `\\${phoneticText}\\` : undefined,
      audio,
      meanings,
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Free Dictionary API (api.dictionaryapi.dev) source block.
 */
async function fetchFreeDictionary(word: string): Promise<SourceBlock | null> {
  try {
    const response = await fetchWithTimeout(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );
    if (!response.ok) return null;

    const data: RawFreeDictEntry[] = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const normalizedEntry = normalizeFreeDictEntry(data[0]);
    if (data.length > 1) {
      for (let i = 1; i < data.length; i++) {
        const extra = normalizeFreeDictEntry(data[i]);
        normalizedEntry.meanings.push(...extra.meanings);
        if (!normalizedEntry.phonetics?.length && extra.phonetics?.length) {
          normalizedEntry.phonetics = extra.phonetics;
        }
      }
    }

    if (normalizedEntry.meanings.length === 0) return null;

    return {
      provider: 'free-dictionary',
      label: PROVIDER_LABELS['free-dictionary'],
      phonetic: normalizedEntry.phonetic || undefined,
      audio: normalizedEntry.phonetics?.find(p => p.audio)?.audio,
      meanings: normalizedEntry.meanings,
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Wiktionary API fallback source block
 */
async function fetchWiktionary(word: string): Promise<SourceBlock | null> {
  try {
    const res = await fetchWithTimeout(`https://en.wiktionary.org/api/rest_v1/page/summary/${encodeURIComponent(word)}`);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data || !data.extract) return null;

    return {
      provider: 'wiktionary',
      label: PROVIDER_LABELS.wiktionary,
      phonetic: data.title ? `/${data.title}/` : undefined,
      meanings: [
        {
          partOfSpeech: data.type || 'definition',
          definitions: [
            {
              definition: data.extract,
              example: data.description || undefined,
            },
          ],
        },
      ],
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Datamuse API fallback source block for definitions, phrases, and word metadata
 */
async function fetchDatamuse(word: string): Promise<SourceBlock | null> {
  try {
    const res = await fetchWithTimeout(`https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=dpsr&max=1`);
    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const item = data[0];
    if (!item.defs || item.defs.length === 0) return null;

    const meaningsMap = new Map<string, DefinitionItem[]>();

    for (const defStr of item.defs) {
      const parts = defStr.split('\t');
      let pos = 'general';
      let defText = defStr;

      if (parts.length > 1) {
        const rawPos = parts[0].trim();
        defText = parts.slice(1).join('\t').trim();
        if (rawPos === 'n') pos = 'noun';
        else if (rawPos === 'v') pos = 'verb';
        else if (rawPos === 'adj') pos = 'adjective';
        else if (rawPos === 'adv') pos = 'adverb';
        else pos = rawPos;
      }

      if (!meaningsMap.has(pos)) {
        meaningsMap.set(pos, []);
      }
      meaningsMap.get(pos)!.push({ definition: defText });
    }

    const meanings: Meaning[] = Array.from(meaningsMap.entries()).map(([partOfSpeech, definitions]) => ({
      partOfSpeech,
      definitions,
    }));

    return {
      provider: 'datamuse',
      label: PROVIDER_LABELS.datamuse,
      meanings,
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Wikipedia API fallback source block for compound concepts and encyclopedic terms
 */
async function fetchWikipedia(word: string): Promise<SourceBlock | null> {
  try {
    const res = await fetchWithTimeout(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(word)}`);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data || !data.extract || data.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') return null;

    return {
      provider: 'wikipedia',
      label: PROVIDER_LABELS.wikipedia,
      meanings: [
        {
          partOfSpeech: data.description || 'phrase / topic',
          definitions: [
            {
              definition: data.extract,
              example: data.description ? `Category: ${data.description}` : undefined,
            },
          ],
        },
      ],
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/** Merges several source blocks' meanings into one flat meanings[] for the combined view. */
function mergeSourceBlocks(blocks: SourceBlock[]): Meaning[] {
  const merged: Meaning[] = [];
  for (const block of blocks) {
    for (const meaning of block.meanings) {
      merged.push(meaning);
    }
  }
  return merged;
}

/**
 * Helper to enrich merged meanings with synonyms and antonyms if missing (via Datamuse).
 */
async function enrichSynonymsAndAntonyms(entry: DictionaryEntry): Promise<DictionaryEntry> {
  const hasSynonyms = entry.meanings.some(m => (m.synonyms && m.synonyms.length > 0) || m.definitions.some(d => d.synonyms && d.synonyms.length > 0));
  const hasAntonyms = entry.meanings.some(m => (m.antonyms && m.antonyms.length > 0) || m.definitions.some(d => d.antonyms && d.antonyms.length > 0));

  if (hasSynonyms && hasAntonyms) return entry;

  try {
    const promises: Promise<any>[] = [];

    if (!hasSynonyms) {
      promises.push(
        fetchWithTimeout(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(entry.word)}&max=8`, 4000)
          .then(r => r.ok ? r.json() : [])
          .catch(() => [])
      );
    } else {
      promises.push(Promise.resolve([]));
    }

    if (!hasAntonyms) {
      promises.push(
        fetchWithTimeout(`https://api.datamuse.com/words?rel_ant=${encodeURIComponent(entry.word)}&max=8`, 4000)
          .then(r => r.ok ? r.json() : [])
          .catch(() => [])
      );
    } else {
      promises.push(Promise.resolve([]));
    }

    const [synData, antData] = await Promise.all(promises);

    const fetchedSynonyms: string[] = Array.isArray(synData) ? synData.map((i: any) => i.word) : [];
    const fetchedAntonyms: string[] = Array.isArray(antData) ? antData.map((i: any) => i.word) : [];

    if (fetchedSynonyms.length > 0 || fetchedAntonyms.length > 0) {
      const meaningsCopy = [...entry.meanings];
      if (meaningsCopy.length > 0) {
        meaningsCopy[0] = {
          ...meaningsCopy[0],
          synonyms: hasSynonyms ? meaningsCopy[0].synonyms : fetchedSynonyms,
          antonyms: hasAntonyms ? meaningsCopy[0].antonyms : fetchedAntonyms,
        };
        entry.meanings = meaningsCopy;
      }
    }
  } catch {
    // Fail silently on enrichment
  }

  return entry;
}

/**
 * Fetches all primary providers (Merriam-Webster Dictionary+Thesaurus, Free Dictionary API)
 * in parallel, then falls back to Wiktionary / Datamuse / Wikipedia only if neither primary
 * provider returned anything usable. Combines whatever answered into one DictionaryEntry with
 * a merged `meanings[]` plus a per-provider `sources[]` breakdown for the "more options" view.
 */
async function fetchFromAllProviders(word: string): Promise<DictionaryEntry | null> {
  // Race the two primary, authoritative sources in parallel rather than sequentially —
  // this is what makes online lookups fast: total latency is max(MW, FreeDictionary),
  // not their sum.
  const [mwResult, freeDictResult] = await Promise.allSettled([
    fetchMerriamWebster(word),
    fetchFreeDictionary(word),
  ]);

  const sources: SourceBlock[] = [];
  if (mwResult.status === 'fulfilled' && mwResult.value) sources.push(mwResult.value);
  if (freeDictResult.status === 'fulfilled' && freeDictResult.value) sources.push(freeDictResult.value);

  // Only reach for the secondary fallbacks (also run in parallel) if both primary
  // sources came back empty, so we don't pay their latency on the common path.
  if (sources.length === 0) {
    const [wikt, datamuse, wiki] = await Promise.allSettled([
      fetchWiktionary(word),
      fetchDatamuse(word),
      fetchWikipedia(word),
    ]);
    if (wikt.status === 'fulfilled' && wikt.value) sources.push(wikt.value);
    if (datamuse.status === 'fulfilled' && datamuse.value) sources.push(datamuse.value);
    if (wiki.status === 'fulfilled' && wiki.value) sources.push(wiki.value);
  }

  if (sources.length === 0) return null;

  const primary = sources.find(s => s.provider === 'merriam-webster') || sources[0];
  const normalizedWord = word.toLowerCase().trim();

  const entry: DictionaryEntry = {
    word: normalizedWord,
    phonetic: primary.phonetic || sources.find(s => s.phonetic)?.phonetic,
    phonetics: sources.filter(s => s.audio || s.phonetic).map(s => ({ text: s.phonetic, audio: s.audio })),
    meanings: mergeSourceBlocks(sources),
    sources,
    // Keep the coarse `source` field meaningful for existing UI (badges, filtering, exports):
    // prefer 'merriam-webster' as its own literal, everything else collapses to 'api'.
    source: sources.some(s => s.provider === 'merriam-webster') ? 'merriam-webster' : 'api',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return enrichSynonymsAndAntonyms(entry);
}

/**
 * Main dictionary lookup function (Handles Cache -> API -> Fallback).
 *
 * Fast-sync strategy: if a cached entry already exists, it's returned *immediately*
 * (no network round-trip) so the UI never waits on the network for a word it has seen
 * before. If that cached entry is stale (older than CACHE_FRESH_WINDOW_MS) and we're
 * online, a background refetch is kicked off; when it completes, `onRevalidated` is
 * called with the fresh result so the caller can silently update the UI + IndexedDB
 * without showing a loading spinner.
 */
export async function lookupWord(
  word: string,
  options: boolean | LookupOptions = false
): Promise<FetchWordResult> {
  const opts: LookupOptions = typeof options === 'boolean' ? { forceOnline: options } : options;
  const forceOnline = opts.forceOnline ?? false;

  const normalizedWord = word.toLowerCase().trim();
  if (!normalizedWord) {
    return { entry: null, fromCache: false, isOffline: !navigator.onLine, error: 'Please enter a word.' };
  }

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // 1. Check local IndexedDB cache first — this is what makes lookups feel instant.
  const localEntry = await getWordFromDB(normalizedWord);

  // If offline or forced offline or local entry exists and not forced refresh
  if (localEntry && (!isOnline || !forceOnline)) {
    await addSearchHistory(normalizedWord);

    const isStale = isOnline && Date.now() - (localEntry.updatedAt || 0) > CACHE_FRESH_WINDOW_MS;

    // Fire-and-forget background revalidation: refresh from the network without
    // blocking the instant cached response the user already sees.
    if (isStale && opts.onRevalidated) {
      fetchFromAllProviders(normalizedWord)
        .then(async fresh => {
          if (!fresh) return;
          if (localEntry.isBookmarked) fresh.isBookmarked = true;
          if (localEntry.notes) fresh.notes = localEntry.notes;
          await saveWordToDB(fresh);
          opts.onRevalidated?.({ entry: fresh, fromCache: false, isOffline: false, revalidating: false });
        })
        .catch(() => {
          // Background revalidation failures are silent — the cached copy is still valid.
        });
    }

    return {
      entry: localEntry,
      fromCache: true,
      isOffline: !isOnline,
      revalidating: isStale && Boolean(opts.onRevalidated),
    };
  }

  // 2. If offline and exact word not in DB, try fuzzy match
  if (!isOnline) {
    const fuzzyEntry = await fuzzyFindWordFromDB(normalizedWord);
    if (fuzzyEntry) {
      await addSearchHistory(fuzzyEntry.word);
      return {
        entry: fuzzyEntry,
        fromCache: true,
        isOffline: true,
      };
    }

    return {
      entry: null,
      fromCache: false,
      isOffline: true,
      error: `You are currently offline and "${word}" was not found in your local offline dictionary database.`,
      externalLinks: generateExternalLinks(normalizedWord),
    };
  }

  // 3. Online mode: fetch every configured provider in parallel (Merriam-Webster
  //    Dictionary + Thesaurus, Free Dictionary API, with Wiktionary/Datamuse/Wikipedia
  //    as fallbacks) and merge whatever comes back.
  try {
    const combinedEntry = await fetchFromAllProviders(normalizedWord);

    if (combinedEntry) {
      if (localEntry?.isBookmarked) combinedEntry.isBookmarked = true;
      if (localEntry?.notes) combinedEntry.notes = localEntry.notes;

      await saveWordToDB(combinedEntry);
      await addSearchHistory(normalizedWord);

      return {
        entry: combinedEntry,
        fromCache: false,
        isOffline: false,
      };
    }

    // If word exists in local DB (e.g., custom user word or starter word), fallback to local entry
    if (localEntry) {
      await addSearchHistory(normalizedWord);
      return {
        entry: localEntry,
        fromCache: true,
        isOffline: false,
      };
    }

    // Word not found anywhere
    return {
      entry: null,
      fromCache: false,
      isOffline: false,
      error: `No online definition found for "${word}". You can add it as a custom word or search external web sources.`,
      externalLinks: generateExternalLinks(normalizedWord),
    };
  } catch (err) {
    // Network or fetch error
    if (localEntry) {
      return {
        entry: localEntry,
        fromCache: true,
        isOffline: false,
      };
    }

    return {
      entry: null,
      fromCache: false,
      isOffline: !isOnline,
      error: `Network error looking up "${word}". Please check your internet connection.`,
      externalLinks: generateExternalLinks(normalizedWord),
    };
  }
}

/**
 * Generates helpful external dictionary/reference links for a word — shown below the
 * Word Card so the user can cross-check a definition on sites without a free public API.
 */
export function generateExternalLinks(word: string) {
  const w = encodeURIComponent(word.trim());
  return [
    { title: 'Google Search', url: `https://www.google.com/search?q=define+${w}` },
    { title: 'Wikimedia (Wiktionary)', url: `https://en.wiktionary.org/wiki/${w}` },
    { title: 'Cambridge Dictionary', url: `https://dictionary.cambridge.org/dictionary/english/${w}` },
    { title: 'Oxford Learner\u2019s Dictionary', url: `https://www.oxfordlearnersdictionaries.com/definition/english/${w}` },
    { title: 'Merriam-Webster', url: `https://www.merriam-webster.com/dictionary/${w}` },
  ];
}

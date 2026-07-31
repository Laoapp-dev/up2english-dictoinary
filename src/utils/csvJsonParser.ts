import Papa from 'papaparse';
import { DictionaryEntry, RawCustomWordInput, ImportSummary } from '../types';

/**
 * Clean string array from comma-separated string, semicolon-separated string, or array
 */
function normalizeStringArray(val?: any): string[] | undefined {
  if (!val) return undefined;
  if (Array.isArray(val)) {
    const cleaned = val.map(s => String(s).trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : undefined;
  }
  if (typeof val === 'string') {
    const cleaned = val
      .split(/[,;|]/)
      .map(s => s.trim())
      .filter(Boolean);
    return cleaned.length > 0 ? cleaned : undefined;
  }
  return undefined;
}

/**
 * Converts raw imported input to standard DictionaryEntry with all detailed fields
 */
export function convertRawInputToEntry(raw: Record<string, any>): DictionaryEntry | null {
  if (!raw || typeof raw !== 'object') return null;

  const word = String(raw.word || raw.term || raw.headword || '').trim().toLowerCase();
  const rawDef = raw.definition || raw.meaning || raw.description || (Array.isArray(raw.definitions) ? raw.definitions.join('; ') : raw.definitions);
  const definition = String(rawDef || '').trim();

  if (!word || !definition) {
    return null;
  }

  const phoneticText = String(
    raw.pronunciation || raw.phonetic || raw.ipa || raw.pron || ''
  ).trim();

  const pos = String(
    raw.partofspeech || raw.partOfSpeech || raw.pos || raw.type || raw.category || 'noun'
  ).toLowerCase().trim();

  const exampleText = String(
    raw['sample sentence'] ||
    raw.samplesentence ||
    raw.sampleSentence ||
    raw.sample_sentence ||
    raw.example ||
    raw.sentence ||
    ''
  ).trim();

  const rawSyn = raw.synonym || raw.synonyms || raw.syn;
  const rawAnt = raw.antonym || raw.antonyms || raw.ant;

  const synonymsArr = normalizeStringArray(rawSyn);
  const antonymsArr = normalizeStringArray(rawAnt);

  const formattedPhonetic = phoneticText
    ? (phoneticText.startsWith('/') ? phoneticText : `/${phoneticText}/`)
    : undefined;

  const entry: DictionaryEntry = {
    word,
    phonetic: formattedPhonetic,
    phonetics: formattedPhonetic ? [{ text: formattedPhonetic }] : [],
    source: 'custom',
    meanings: [
      {
        partOfSpeech: pos,
        definitions: [
          {
            definition,
            example: exampleText || undefined,
            synonyms: synonymsArr,
            antonyms: antonymsArr,
          }
        ],
        synonyms: synonymsArr,
        antonyms: antonymsArr,
      }
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return entry;
}

/**
 * Parse JSON string or object array
 */
export function parseJSONData(content: string): { entries: DictionaryEntry[]; errors: string[] } {
  const errors: string[] = [];
  const entries: DictionaryEntry[] = [];

  try {
    const parsed = JSON.parse(content);
    const items = Array.isArray(parsed) ? parsed : [parsed];

    items.forEach((item, index) => {
      if (typeof item !== 'object' || item === null) {
        errors.push(`Row ${index + 1}: Invalid JSON item structure.`);
        return;
      }

      // Check if item is already formatted as DictionaryEntry
      if (item.word && item.meanings && Array.isArray(item.meanings)) {
        entries.push({
          ...item,
          word: String(item.word).toLowerCase().trim(),
          source: 'custom',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        return;
      }

      // Convert from RawCustomWordInput format
      const entry = convertRawInputToEntry(item as RawCustomWordInput);
      if (entry) {
        entries.push(entry);
      } else {
        errors.push(`Item ${index + 1}: Missing required fields "word" or "definition".`);
      }
    });
  } catch (err) {
    errors.push(`Failed to parse JSON content: ${(err as Error).message}`);
  }

  return { entries, errors };
}

/**
 * Parse CSV string using PapaParse
 */
export function parseCSVData(csvContent: string): { entries: DictionaryEntry[]; errors: string[] } {
  const errors: string[] = [];
  const entries: DictionaryEntry[] = [];

  const results = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim().toLowerCase().replace(/[\s_]+/g, ''),
  });

  if (results.errors && results.errors.length > 0) {
    results.errors.forEach(err => {
      errors.push(`CSV Error at row ${err.row}: ${err.message}`);
    });
  }

  results.data.forEach((row, idx) => {
    const entry = convertRawInputToEntry(row);
    if (entry) {
      entries.push(entry);
    } else {
      const rawWord = row.word || row.term || row.headword || '';
      const rawDef = row.definition || row.meaning || row.description || '';
      if (rawWord || rawDef) {
        errors.push(`CSV Row ${idx + 2}: Missing required field "word" or "definition".`);
      }
    }
  });

  return { entries, errors };
}

/**
 * Export dictionary entries to formatted JSON file
 */
export function exportToJSONFile(entries: DictionaryEntry[], filename: string = 'dictionary_export.json'): void {
  const jsonStr = JSON.stringify(entries, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export dictionary entries to CSV file
 */
export function exportToCSVFile(entries: DictionaryEntry[], filename: string = 'dictionary_export.csv'): void {
  const csvRows = entries.map(entry => {
    const pos = entry.meanings[0]?.partOfSpeech || 'noun';
    const def = entry.meanings[0]?.definitions[0]?.definition || '';
    const example = entry.meanings[0]?.definitions[0]?.example || '';
    const syns = entry.meanings[0]?.definitions[0]?.synonyms?.join(', ') || '';
    const ants = entry.meanings[0]?.definitions[0]?.antonyms?.join(', ') || '';

    return {
      word: entry.word,
      pronunciation: entry.phonetic || '',
      partofspeech: pos,
      definition: def,
      'sample sentence': example,
      synonym: syns,
      antonym: ants,
    };
  });

  const csvStr = Papa.unparse(csvRows);
  const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Sample template helpers
 */
export function getSampleCSVTemplate(): string {
  return `word,pronunciation,partofspeech,definition,sample sentence,synonym,antonym
quintessence,/kwɪnˈtɛsəns/,noun,The most perfect example of a quality or class.,He was the quintessence of calm professionalism.,embodiment; epitome,antithesis
solitude,/ˈsɒlɪtjuːd/,noun,The state or situation of being alone.,She enjoyed the peaceful solitude of the library.,isolation; seclusion,companionship
veracity,/vəˈræsɪti/,noun,Conformity to facts or accuracy.,The lawyer questioned the veracity of the witness.,truthfulness; accuracy,falsehood; deceit`;
}

export function getSampleJSONTemplate(): string {
  return JSON.stringify(
    [
      {
        word: "quintessence",
        pronunciation: "/kwɪnˈtɛsəns/",
        partofspeech: "noun",
        definition: "The most perfect example of a quality or class.",
        sampleSentence: "He was the quintessence of calm professionalism.",
        synonyms: ["embodiment", "epitome"],
        antonyms: ["antithesis"]
      },
      {
        word: "solitude",
        pronunciation: "/ˈsɒlɪtjuːd/",
        partofspeech: "noun",
        definition: "The state or situation of being alone.",
        sampleSentence: "She enjoyed the peaceful solitude of the library.",
        synonyms: ["isolation", "seclusion"],
        antonyms: ["companionship"]
      }
    ],
    null,
    2
  );
}

import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  Download, 
  FileText, 
  FileCode, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  HelpCircle,
  Database
} from 'lucide-react';
import { 
  parseJSONData, 
  parseCSVData, 
  exportToJSONFile, 
  exportToCSVFile, 
  getSampleCSVTemplate, 
  getSampleJSONTemplate 
} from '../utils/csvJsonParser';
import { bulkInsertWordsToDB, getAllStoredWords } from '../db/indexedDB';
import { DictionaryEntry, ImportSummary } from '../types';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'paste' | 'export'>('import');
  const [pastedText, setPastedText] = useState('');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  if (!isOpen) return null;

  // Process raw text content (from file or paste)
  const processImportContent = async (content: string, type: 'csv' | 'json') => {
    setIsProcessing(true);
    setSummary(null);

    try {
      const parsed = type === 'json' ? parseJSONData(content) : parseCSVData(content);

      if (parsed.entries.length === 0) {
        setSummary({
          total: 0,
          success: 0,
          duplicates: 0,
          errors: parsed.errors.length ? parsed.errors : ['No valid word definitions found.'],
        });
        setIsProcessing(false);
        return;
      }

      // Save to IndexedDB
      const result = await bulkInsertWordsToDB(parsed.entries);

      setSummary({
        total: parsed.entries.length,
        success: result.added + result.updated,
        duplicates: result.updated,
        errors: parsed.errors,
      });

      onImportSuccess();
    } catch (err) {
      setSummary({
        total: 0,
        success: 0,
        duplicates: 0,
        errors: [`Processing failed: ${(err as Error).message}`],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isCsv = fileName.endsWith('.csv');
    const isJson = fileName.endsWith('.json');

    if (!isCsv && !isJson) {
      setSummary({
        total: 0,
        success: 0,
        duplicates: 0,
        errors: ['Invalid file type. Please upload a .csv or .json file.'],
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        processImportContent(text, isCsv ? 'csv' : 'json');
      }
    };
    reader.readAsText(file);
  };

  // Handle Paste Submit
  const handlePasteSubmit = () => {
    if (!pastedText.trim()) return;
    processImportContent(pastedText, format);
  };

  // Handle Export All
  const handleExport = async (exportFormat: 'json' | 'csv') => {
    try {
      const words = await getAllStoredWords();
      if (words.length === 0) {
        alert('No words found in database to export.');
        return;
      }
      if (exportFormat === 'json') {
        exportToJSONFile(words, `lexicon_dictionary_${Date.now()}.json`);
      } else {
        exportToCSVFile(words, `lexicon_dictionary_${Date.now()}.csv`);
      }
    } catch (err) {
      alert(`Export error: ${(err as Error).message}`);
    }
  };

  // Copy sample template
  const handleCopyTemplate = (tmplFormat: 'csv' | 'json') => {
    const tmpl = tmplFormat === 'csv' ? getSampleCSVTemplate() : getSampleJSONTemplate();
    navigator.clipboard.writeText(tmpl);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-zinc-200 dark:border-zinc-700/80 max-h-[90vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Custom Data Import & Export
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Load offline JSON or CSV dictionary datasets into IndexedDB
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-6 p-1 bg-zinc-100 dark:bg-zinc-900/60 rounded-2xl">
          <button
            onClick={() => {
              setActiveTab('import');
              setSummary(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'import'
                ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            Upload File (.csv / .json)
          </button>
          <button
            onClick={() => {
              setActiveTab('paste');
              setSummary(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'paste'
                ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            Paste Text
          </button>
          <button
            onClick={() => {
              setActiveTab('export');
              setSummary(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'export'
                ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            Export Words
          </button>
        </div>

        {/* Tab 1: Upload File */}
        {activeTab === 'import' && (
          <div className="mt-6 space-y-4">
            <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-2xl p-8 text-center bg-zinc-50/50 dark:bg-zinc-900/30 transition-colors cursor-pointer group relative">
              <input
                type="file"
                accept=".csv, .json"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <p className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm sm:text-base">
                Click or drag & drop CSV or JSON file here
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Supports PapaParse CSV files & standard dictionary JSON arrays
              </p>
            </div>

            {/* Template samples guidance */}
            <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-xs text-indigo-950 dark:text-indigo-200">
              <div className="flex items-center justify-between font-bold mb-2">
                <span className="flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-indigo-500" /> Standard Column Schema
                </span>
                <button
                  onClick={() => handleCopyTemplate('csv')}
                  className="text-[11px] bg-white dark:bg-zinc-800 px-2 py-1 rounded-md border border-indigo-200 dark:border-indigo-800 font-semibold flex items-center gap-1 hover:bg-indigo-100 dark:hover:bg-zinc-700 transition-colors"
                >
                  {copiedTemplate ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  Copy Sample CSV
                </button>
              </div>
              <p className="font-mono bg-white/80 dark:bg-zinc-900/80 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900 text-[11px] overflow-x-auto">
                word,pronunciation,partofspeech,definition,sample sentence,synonym,antonym
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Paste Text */}
        {activeTab === 'paste' && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                Select Format
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFormat('csv')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    format === 'csv'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  CSV
                </button>
                <button
                  onClick={() => setFormat('json')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    format === 'json'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  JSON
                </button>
              </div>
            </div>

            <textarea
              rows={8}
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
              placeholder={
                format === 'csv'
                  ? getSampleCSVTemplate()
                  : getSampleJSONTemplate()
              }
              className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono text-xs border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />

            <button
              onClick={handlePasteSubmit}
              disabled={isProcessing || !pastedText.trim()}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-2xl text-sm transition-all flex items-center justify-center gap-2"
            >
              {isProcessing ? 'Processing Data...' : 'Import Dataset to Local Database'}
            </button>
          </div>
        )}

        {/* Tab 3: Export Words */}
        {activeTab === 'export' && (
          <div className="mt-6 space-y-6 text-center py-4">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Database className="w-8 h-8" />
            </div>
            <div>
              <h4 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
                Export Local Dictionary
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mt-1">
                Download your entire cached and custom offline dictionary database for backup, migration, or external use.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              <button
                onClick={() => handleExport('csv')}
                className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all flex flex-col items-center gap-2"
              >
                <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200">
                  Export CSV
                </span>
                <span className="text-[11px] text-zinc-400">Comma Separated</span>
              </button>

              <button
                onClick={() => handleExport('json')}
                className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all flex flex-col items-center gap-2"
              >
                <FileCode className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200">
                  Export JSON
                </span>
                <span className="text-[11px] text-zinc-400">Structured Array</span>
              </button>
            </div>
          </div>
        )}

        {/* Results Summary Banner */}
        {summary && (
          <div className="mt-6 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-zinc-900 dark:text-zinc-100">
              {summary.success > 0 ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-500" />
              )}
              <span>Import Results Summary</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-2">
              <div className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700">
                <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{summary.total}</div>
                <div className="text-[10px] text-zinc-400 uppercase font-semibold">Parsed</div>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700">
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{summary.success}</div>
                <div className="text-[10px] text-zinc-400 uppercase font-semibold">Saved to DB</div>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700">
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{summary.duplicates}</div>
                <div className="text-[10px] text-zinc-400 uppercase font-semibold">Updated</div>
              </div>
            </div>

            {summary.errors.length > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                <div className="font-semibold">Errors / Warnings:</div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] max-h-32 overflow-y-auto">
                  {summary.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

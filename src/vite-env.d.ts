/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Merriam-Webster Collegiate Dictionary API key (https://dictionaryapi.com) */
  readonly VITE_MW_DICT_KEY?: string;
  /** Merriam-Webster Collegiate Thesaurus API key (https://dictionaryapi.com) */
  readonly VITE_MW_THESAURUS_KEY?: string;
  /** Google Cloud Text-to-Speech API key (https://console.cloud.google.com) */
  readonly VITE_GOOGLE_TTS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

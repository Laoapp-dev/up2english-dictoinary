# Lexicon - Modern Online & Offline PWA Dictionary Application

Lexicon is a fast, clean, modern web-based dictionary application optimized for both live API fetching and offline usage using IndexedDB (`idb`) and full CSV/JSON dataset import/export.

Built with **React, Vite, TypeScript, Tailwind CSS, and IndexedDB**.

---

## ✨ Key Features

- **Parallel Multi-Source Dictionary Architecture**:
  1. **Merriam-Webster Collegiate Dictionary + Thesaurus API** *(optional, if you configure API keys)* — authoritative definitions, pronunciations, audio, synonyms & antonyms, including verbal-illustration sample sentences.
  2. **Free Dictionary API** — no key required, always fetched *in parallel* with Merriam-Webster (not just as a fallback), so the Word Card can show "more options" — each source's own definitions & sample sentences side by side.
  3. **Wiktionary / Datamuse / Wikipedia** — additional free fallbacks, only queried if neither primary source has the word.
  - **IndexedDB Caching + Stale-While-Revalidate Sync**: Every searched word is cached locally, returned instantly from IndexedDB on repeat lookups, and silently refreshed from the network in the background when the cache is more than 6 hours old — the UI never blocks on the network for a word it has already seen.
  - **Per-provider request timeouts**: each API call races against a 6s timeout so one slow source never stalls the whole lookup; primary sources are fetched with `Promise.allSettled`, so total latency is the *slowest* of the two, not their sum.
  - **Offline Starter Dataset**: Pre-populated with 40+ curated words on first launch for instant offline lookups out-of-the-box.
  - **Web Fallback Links**: Below the Word Card, quick links to Google Search, Wikimedia (Wiktionary), Cambridge Dictionary, Oxford Learner's Dictionary, and Merriam-Webster for expanded lookups.

- **Custom CSV & JSON Dataset Import & Export**:
  - Drag & drop file upload or direct text paste for `.csv` and `.json` dictionary files.
  - Header auto-detection and PapaParse CSV parser with detailed error validation summaries.
  - Export custom or entire local dictionary to JSON or CSV file for backup/migration.

- **User Interface & Experience**:
  - Minimalist, accessible, high-contrast design with Dark/Light mode toggle.
  - Live autocomplete search bar with voice speech input (`SpeechRecognition`) and keyboard navigation.
  - Audio Pronunciation: dictionary API audio file → Google Cloud Text-to-Speech (if configured) → native `speechSynthesis`, in that order.
  - Interactive Clickable Synonyms & Antonyms chips.
  - Bookmarks & Saved Words vocabulary list.
  - Recent Search History manager.

- **PWA & Offline Readiness**:
  - Hand-written Service Worker (`public/sw.js`) — no CDN dependency:
    - App shell (HTML, manifest, icons) precached on install.
    - Same-origin build assets cached **cache-first**, populated as you browse.
    - Navigation requests use **network-first with offline fallback** (`offline.html`), so client-side routing keeps working without a connection.
    - Dictionary/thesaurus/audio API requests use **stale-while-revalidate**, so a word you already looked up loads instantly from the SW cache while a fresh copy is fetched in the background.
    - Old cache versions are cleaned up automatically on activate.
  - Web App Manifest (`public/manifest.json`) — portable relative icon paths (works on any deploy path, not just GitHub Pages), maskable icons, and install shortcuts for "Random Word" and "Saved Words".
  - Real-time online/offline network indicator, plus a background "syncing latest definitions" indicator when a stale cached word is being refreshed.

---

## 📄 Custom Dataset Schema (CSV & JSON)

### CSV Schema Format
```csv
word,pronunciation,partofspeech,definition,sample sentence,synonym,antonym
quintessence,/kwɪnˈtɛsəns/,noun,The most perfect example of a quality or class.,He was the quintessence of calm professionalism.,embodiment; epitome,antithesis
solitude,/ˈsɒlɪtjuːd/,noun,The state or situation of being alone.,She enjoyed the peaceful solitude of the library.,isolation; seclusion,companionship
```

### JSON Schema Format
```json
[
  {
    "word": "quintessence",
    "pronunciation": "/kwɪnˈtɛsəns/",
    "partofspeech": "noun",
    "definition": "The most perfect example of a quality or class.",
    "sampleSentence": "He was the quintessence of calm professionalism.",
    "synonyms": ["embodiment", "epitome"],
    "antonyms": ["antithesis"]
  }
]
```

---

## 📖 Merriam-Webster API Setup (optional)

The app works fully with zero configuration using the free Dictionary API. To upgrade to
Merriam-Webster's dictionary and thesaurus data, register two free apps at
[dictionaryapi.com/register](https://dictionaryapi.com/register/index):

1. Register once for the **Collegiate Dictionary** API → copy the key.
2. Register a second time for the **Collegiate Thesaurus** API → copy that key too (this one is optional; it only adds synonyms/antonyms).

### ⚠️ Important: these keys are not truly "secret" once deployed

GitHub Pages only serves static files — there is no server to hide a key behind. Whatever key
you provide gets baked directly into the JavaScript bundle at **build time**, so anyone who opens
their browser DevTools can read it out of the deployed site. Using a GitHub Actions secret keeps
the key **out of your git history and off your screen when you share the repo**, but it does **not**
keep it hidden from end users of the live site.

This is fine in practice for Merriam-Webster's free developer keys — they're rate-limited per key,
not billed, and revocable any time from your dictionaryapi.com dashboard. Just don't reuse a key
that's shared with a paid/production system, and rotate it if you ever see abnormal usage on your
dictionaryapi.com dashboard.

### Configure the keys

**For local development:**
```bash
cp .env.example .env
# then edit .env and paste in your real keys
npm run dev
```

**For the GitHub Pages deployment** (recommended way — keeps keys out of your commits):
1. In your GitHub repo, go to **Settings → Secrets and variables → Actions**.
2. Click **New repository secret** and add:
   - Name: `VITE_MW_DICT_KEY` → Value: your Collegiate Dictionary key
   - Name: `VITE_MW_THESAURUS_KEY` → Value: your Collegiate Thesaurus key (optional)
3. Push to `main`/`master` — the included workflow (`.github/workflows/deploy.yml`) automatically
   passes these secrets into `npm run build` as environment variables, and Vite embeds them into
   the built bundle.

If no keys are configured, Merriam-Webster is simply skipped and the app falls back to the free
Dictionary API automatically — nothing breaks.

---

## 🔊 Google Cloud Text-to-Speech Setup (optional)

Adds higher-quality pronunciation audio (Google's Neural2 voices) for words where the dictionary
source doesn't provide its own audio file. If skipped, the app falls back to your browser's
built-in `speechSynthesis` voice — still functional, just more robotic.

1. In the [Google Cloud Console](https://console.cloud.google.com/), create/select a project and
   enable the **Cloud Text-to-Speech API**.
2. Go to **APIs & Services → Credentials → Create Credentials → API key**.
3. **Strongly recommended:** click the new key → **Application restrictions → Websites** → add
   your GitHub Pages URL (e.g. `https://your-username.github.io/*`). Unlike Merriam-Webster,
   Google Cloud API keys support this restriction, so the key only works when called from your
   deployed site — it won't function if copied and used elsewhere. Also set **API restrictions**
   to only "Cloud Text-to-Speech API" to limit blast radius.
4. Set a billing budget alert on the project — Text-to-Speech has a free monthly quota (currently
   4 million characters for standard voices / 1 million for WaveNet & Neural2), but you're
   responsible for anything beyond that if the key is ever abused.
5. Add the key as a repository secret named **`VITE_GOOGLE_TTS_API_KEY`** (same steps as the
   Merriam-Webster keys above), or put it in your local `.env` for development.

---

## 🚀 Local Development Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Local Dev Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

3. **Build Production Application**:
   ```bash
   npm run build
   ```

---

## 🌐 Deploying to GitHub Pages

1. **Push code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Up2Eng Dictionary PWA"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
   git push -u origin main
   ```

2. **Automated GitHub Actions Deployment**:
   - The repository includes a preconfigured GitHub Actions workflow (`.github/workflows/deploy.yml`).
   - In your GitHub Repository settings, go to **Settings > Pages**.
   - Under **Build and deployment > Source**, select **GitHub Actions**.
   - (Optional) Add your Merriam-Webster and/or Google Cloud TTS API keys as repository secrets — see [Merriam-Webster API Setup](#-merriam-webster-api-setup-optional) and [Google Cloud Text-to-Speech Setup](#-google-cloud-text-to-speech-setup-optional) above.
   - Push any commit to `main` or `master` to trigger automated deployment!

3. **Manual CLI Deployment (Alternative)**:
   ```bash
   npm run deploy
   ```

---

## 📱 Installing as Progressive Web App (PWA)

1. Open the application in Chrome, Edge, Safari, or mobile browser.
2. Click the **"Install App"** button in the header bar or select **"Add to Home Screen"** / **"Install Lexicon"** in your browser's menu.
3. Launch Lexicon as a standalone desktop or mobile application with full offline support!

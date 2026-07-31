/**
 * Web Speech API Audio Pronunciation Helper
 */

let currentUtterance: SpeechSynthesisUtterance | null = null;

// Google Cloud Text-to-Speech API key (injected at build time via Vite from a
// GitHub Actions secret). Same caveat as the Merriam-Webster keys: this ends up
// visible in the deployed JS bundle since GitHub Pages has no backend to hide it
// behind. Treat it as a low-privilege key with billing alerts / quota caps set,
// not as a true secret.
const GOOGLE_TTS_API_KEY = import.meta.env.VITE_GOOGLE_TTS_API_KEY;

// In-memory cache so repeat plays of the same word in a session don't re-call the API
const ttsAudioCache = new Map<string, string>();

export function isGoogleTTSConfigured(): boolean {
  return Boolean(GOOGLE_TTS_API_KEY);
}

/**
 * Synthesizes speech using Google Cloud Text-to-Speech and returns a playable
 * data: URL, or null if unconfigured / the request fails.
 */
async function fetchGoogleTTSAudio(text: string, lang: string = 'en-US'): Promise<string | null> {
  if (!GOOGLE_TTS_API_KEY || !text) return null;

  const cacheKey = `${lang}:${text.toLowerCase()}`;
  const cached = ttsAudioCache.get(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: lang, name: 'en-US-Neural2-D', ssmlGender: 'NEUTRAL' },
          audioConfig: { audioEncoding: 'MP3', speakingRate: 0.92 },
        }),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.audioContent) return null;

    const dataUrl = `data:audio/mp3;base64,${data.audioContent}`;
    ttsAudioCache.set(cacheKey, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speakWord(
  text: string,
  options?: {
    lang?: string;
    rate?: number;
    pitch?: number;
    onEnd?: () => void;
    onError?: (err: unknown) => void;
  }
): boolean {
  if (!isSpeechSupported()) return false;

  try {
    window.speechSynthesis.cancel(); // Stop any ongoing speech

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options?.lang || 'en-US';
    utterance.rate = options?.rate || 0.9; // Slightly slower for clarity
    utterance.pitch = options?.pitch || 1.0;

    if (options?.onEnd) {
      utterance.onend = () => options.onEnd?.();
    }
    if (options?.onError) {
      utterance.onerror = (e) => options.onError?.(e);
    }

    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.error('Speech synthesis error:', err);
    return false;
  }
}

export function stopSpeaking(): void {
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Plays a data:/blob:/https: audio URL. Resolves true on success, false on failure.
 */
function playUrl(url: string, onStateChange?: (isPlaying: boolean) => void): Promise<boolean> {
  return new Promise(resolve => {
    try {
      const audio = new Audio(url);
      audio.onended = () => {
        onStateChange?.(false);
        resolve(true);
      };
      audio.onerror = () => resolve(false);
      audio.play().catch(() => resolve(false));
    } catch {
      resolve(false);
    }
  });
}

/**
 * Helper to play an MP3/WAV audio file URL, falling back to Google Cloud TTS
 * (if configured), then finally the browser's built-in speech synthesis.
 */
export async function playAudioOrTTS(
  audioUrl?: string,
  textToSpeak?: string,
  onStateChange?: (isPlaying: boolean) => void
): Promise<void> {
  onStateChange?.(true);

  // 1. Try the dictionary API's own pronunciation audio, if provided
  if (audioUrl) {
    const fullUrl = audioUrl.startsWith('//') ? `https:${audioUrl}` : audioUrl;
    const played = await playUrl(fullUrl, onStateChange);
    if (played) return;
  }

  // 2. Try Google Cloud Text-to-Speech for higher quality pronunciation
  if (textToSpeak) {
    const googleAudioUrl = await fetchGoogleTTSAudio(textToSpeak);
    if (googleAudioUrl) {
      const played = await playUrl(googleAudioUrl, onStateChange);
      if (played) return;
    }
  }

  // 3. Fall back to the browser's built-in speech synthesis
  if (textToSpeak) {
    speakWord(textToSpeak, {
      onEnd: () => onStateChange?.(false),
      onError: () => onStateChange?.(false),
    });
  } else {
    onStateChange?.(false);
  }
}

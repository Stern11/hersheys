/**
 * Voice input, honestly.
 *
 * The old bar rendered a microphone button on every screen that did nothing
 * anywhere — the worst possible state, because a planner cannot tell a dead
 * control from a broken one. The rule here is: **the button exists only where
 * it works.** `speechRecognitionCtor()` returns the browser's constructor or
 * null, and the UI renders the mic only on a non-null result. In Firefox, in
 * a server render, and in any browser without the Web Speech API, there is no
 * button at all rather than a button that silently fails.
 *
 * Transcription is otherwise out of scope for this phase (CLAUDE.md), so
 * there is no cloud transcription fallback and none is implied.
 */

/** Minimal structural type for the bits of the Web Speech API this app uses. */
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
}

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechCapableWindow {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

/**
 * The browser's SpeechRecognition constructor, or null when this environment
 * cannot do speech recognition at all (including SSR, where `window` is
 * undefined). Pure and injectable so it is testable without a browser.
 */
export function speechRecognitionCtor(win: unknown = typeof window === "undefined" ? undefined : window): SpeechRecognitionCtor | null {
  if (!win || typeof win !== "object") return null;
  const w = win as SpeechCapableWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isVoiceInputSupported(win: unknown = typeof window === "undefined" ? undefined : window): boolean {
  return speechRecognitionCtor(win) != null;
}

/**
 * Pulls the best final transcript out of a SpeechRecognition result event.
 * Defensive on purpose: the event shape is a live `SpeechRecognitionResultList`
 * (array-like, not an array), and a malformed event must yield "" rather than
 * throw inside an event handler where nothing would catch it.
 */
export function transcriptFromEvent(event: unknown): string {
  if (!event || typeof event !== "object") return "";
  const results = (event as { results?: unknown }).results;
  if (!results || typeof results !== "object") return "";
  const list = results as ArrayLike<ArrayLike<{ transcript?: unknown }>>;
  const parts: string[] = [];
  for (let i = 0; i < (list.length ?? 0); i += 1) {
    const alternative = list[i]?.[0];
    if (alternative && typeof alternative.transcript === "string") parts.push(alternative.transcript);
  }
  return parts.join(" ").trim();
}

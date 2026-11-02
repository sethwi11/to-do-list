/*
 * A thin wrapper over the browser's Web Speech API (SpeechRecognition).
 *
 * The API isn't in TypeScript's DOM types (it's still a draft, and only Chrome,
 * Edge, and Safari ship it, prefixed as webkitSpeechRecognition), so we
 * declare just the parts we use. Wrapping it also gives the rest of the app a
 * small, stable interface: if we ever switch to a server-side transcriber,
 * only this file changes.
 *
 * Privacy: in Chrome, recognition runs on Google's servers (audio leaves the
 * device). The UI says so next to the mic.
 */

interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: RecognitionAlternative;
}
interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [index: number]: RecognitionResult };
}
interface RecognitionErrorEvent {
  readonly error: string;
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const isSpeechRecognitionSupported = () => typeof window !== 'undefined' && getCtor() !== null;

export type SpeechErrorKind = 'permission-denied' | 'no-microphone' | 'network' | 'no-speech' | 'aborted' | 'other';

/** Turns the API's error codes into categories with messages a person can act on. */
export function describeSpeechError(code: string): { kind: SpeechErrorKind; message: string } {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return {
        kind: 'permission-denied',
        message: 'Microphone access is blocked. Click the camera/mic icon in the address bar, allow the microphone, then try again.',
      };
    case 'audio-capture':
      return { kind: 'no-microphone', message: 'No microphone was found. Plug one in or check your system sound settings.' };
    case 'network':
      return { kind: 'network', message: "Speech recognition needs an internet connection (Chrome sends audio to Google). Check your connection, or use the brain dump box." };
    case 'no-speech':
      return { kind: 'no-speech', message: "I didn't hear anything. Try again a little closer to the mic." };
    case 'aborted':
      return { kind: 'aborted', message: '' };
    default:
      return { kind: 'other', message: `Speech recognition error: ${code}` };
  }
}

export interface CaptureCallbacks {
  /** A finalized phrase. */
  onFinal: (text: string) => void;
  /** The current in-progress phrase (replaces the previous interim). */
  onInterim: (text: string) => void;
  onError: (code: string) => void;
  /** Recognition stopped, for any reason (including Chrome's own silence timeout). */
  onEnd: () => void;
  onStart?: () => void;
}

export class SpeechCapture {
  private recognition: Recognition | null = null;

  constructor(private readonly callbacks: CaptureCallbacks) {}

  start(continuous: boolean): void {
    const Ctor = getCtor();
    if (!Ctor) throw new Error('Speech recognition is not supported in this browser');
    this.abort();

    const r = new Ctor();
    r.continuous = continuous;
    r.interimResults = true;
    r.lang = navigator.language || 'en-US';
    r.onstart = () => this.callbacks.onStart?.();
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]!;
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) this.callbacks.onFinal(text);
        else interim += text;
      }
      this.callbacks.onInterim(interim);
    };
    r.onerror = (e) => this.callbacks.onError(e.error);
    r.onend = () => {
      if (this.recognition === r) this.recognition = null;
      this.callbacks.onEnd();
    };
    this.recognition = r;
    r.start();
  }

  /** Stop listening but deliver any final results still in flight. */
  stop(): void {
    this.recognition?.stop();
  }

  /** Stop immediately and discard pending results. */
  abort(): void {
    const r = this.recognition;
    this.recognition = null;
    if (r) {
      r.onend = null;
      r.onresult = null;
      r.onerror = null;
      r.abort();
    }
  }

  get active(): boolean {
    return this.recognition !== null;
  }
}

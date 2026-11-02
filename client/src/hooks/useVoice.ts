import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExtractMode } from '@todo/shared';
import { describeSpeechError, isSpeechRecognitionSupported, SpeechCapture } from '../speech/SpeechCapture';
import { TranscriptChunker } from '../speech/transcriptChunker';
import { speak, stopSpeaking } from '../speech/tts';

type Utterance = (text: string, mode: ExtractMode, recentContext: string[]) => unknown;

/** Chunks shorter than this many words aren't worth an API call ("um", "okay"). */
const MIN_WORDS = 3;
/** Extra listening time after you release push-to-talk, so your last word isn't clipped. */
const RELEASE_TAIL_MS = 500;

/**
 * Microphone state machine for both voice modes.
 *
 *   push-to-talk: hold → listen → release → (short tail) → stop → send it all.
 *   conversation: listen continuously; Chrome ends recognition after a
 *                 silence or about a minute, so we restart it until you turn it
 *                 off. The chunker decides when to send; the last 2 chunks go
 *                 along as context.
 *
 * The mic only turns on in response to your click or keypress, and `listening`
 * drives an always-visible indicator.
 */
export function useVoice(onUtterance: Utterance) {
  const supported = isSpeechRecognitionSupported();
  const [listening, setListening] = useState(false);
  const [conversationOn, setConversationOn] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;

  const mode = useRef<'idle' | 'ptt' | 'conversation'>('idle');
  const pttFinals = useRef<string[]>([]);
  const pttInterim = useRef('');
  const pausedForSpeech = useRef(false);
  const recentChunks = useRef<string[]>([]);
  const restarts = useRef<number[]>([]);
  const releaseTimer = useRef<number | undefined>(undefined);

  const chunker = useRef<TranscriptChunker | null>(null);
  const capture = useRef<SpeechCapture | null>(null);

  const stopConversationRef = useRef<(message?: string) => void>(() => {});

  if (!capture.current) {
    capture.current = new SpeechCapture({
      onStart: () => setListening(true),
      onFinal: (text) => {
        if (mode.current === 'ptt') {
          pttFinals.current.push(text.trim());
          pttInterim.current = '';
          setLiveText(pttFinals.current.join(' '));
        } else if (mode.current === 'conversation') {
          chunker.current?.addFinal(text);
          setLiveText(chunker.current?.pendingText ?? '');
        }
      },
      onInterim: (text) => {
        if (mode.current === 'ptt') {
          pttInterim.current = text;
          setLiveText([...pttFinals.current, text].join(' ').trim());
        } else if (mode.current === 'conversation') {
          chunker.current?.setInterim(text);
          setLiveText(chunker.current?.pendingText ?? '');
        }
      },
      onError: (code) => {
        const { kind, message } = describeSpeechError(code);
        if (kind === 'aborted') return;
        if (kind === 'no-speech' && mode.current === 'conversation') return; // normal: we'll just restart
        if (mode.current === 'conversation' && kind !== 'no-speech') {
          stopConversationRef.current(message);
          return;
        }
        setError(message);
      },
      onEnd: () => {
        setListening(false);
        if (mode.current === 'ptt') {
          mode.current = 'idle';
          const text = [...pttFinals.current, pttInterim.current].join(' ').trim();
          pttFinals.current = [];
          pttInterim.current = '';
          setLiveText(text);
          if (text) void onUtteranceRef.current(text, 'voice', []);
        } else if (mode.current === 'conversation' && !pausedForSpeech.current) {
          // Chrome ended recognition on its own; restart, unless it keeps
          // failing (e.g. offline), which would otherwise spin forever.
          const now = Date.now();
          restarts.current = [...restarts.current.filter((t) => now - t < 30_000), now];
          if (restarts.current.length > 10) {
            stopConversationRef.current('Listening kept stopping, so I turned conversation mode off. Check your mic and connection.');
            return;
          }
          window.setTimeout(() => {
            if (mode.current === 'conversation' && !pausedForSpeech.current) startCapture();
          }, 250);
        }
      },
    });
  }

  function startCapture() {
    try {
      capture.current!.start(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the microphone.');
      mode.current = 'idle';
      setConversationOn(false);
    }
  }

  // ---- push-to-talk ------------------------------------------------------

  const startHold = useCallback(() => {
    if (!supported || mode.current !== 'idle') return;
    window.clearTimeout(releaseTimer.current);
    stopSpeaking();
    setError(null);
    setLiveText('');
    pttFinals.current = [];
    pttInterim.current = '';
    mode.current = 'ptt';
    startCapture();
  }, [supported]);

  const endHold = useCallback(() => {
    if (mode.current !== 'ptt') return;
    releaseTimer.current = window.setTimeout(() => capture.current?.stop(), RELEASE_TAIL_MS);
  }, []);

  // ---- conversation mode -------------------------------------------------

  const stopConversation = useCallback((message?: string) => {
    if (mode.current !== 'conversation') return;
    mode.current = 'idle';
    setConversationOn(false);
    chunker.current?.flush(); // don't lose what was said right before turning it off
    chunker.current = null;
    capture.current?.abort();
    setListening(false);
    if (message) setError(message);
  }, []);
  stopConversationRef.current = stopConversation;

  const startConversation = useCallback(() => {
    if (!supported || mode.current !== 'idle') return;
    setError(null);
    setLiveText('');
    recentChunks.current = [];
    restarts.current = [];
    chunker.current = new TranscriptChunker({
      onChunk: (text) => {
        setLiveText('');
        if (text.split(/\s+/).length < MIN_WORDS) return;
        const context = recentChunks.current.slice(-2);
        recentChunks.current = [...recentChunks.current, text].slice(-3);
        void onUtteranceRef.current(text, 'conversation', context);
      },
    });
    mode.current = 'conversation';
    setConversationOn(true);
    startCapture();
  }, [supported]);

  // ---- speaking without hearing ourselves -------------------------------

  /** Speak; if conversation mode is listening, pause the mic until speech ends. */
  const say = useCallback(async (text: string) => {
    const wasListening = mode.current === 'conversation';
    if (wasListening) {
      pausedForSpeech.current = true;
      capture.current?.abort();
      setListening(false);
    }
    setSpeaking(true);
    try {
      await speak(text);
    } finally {
      setSpeaking(false);
      pausedForSpeech.current = false;
      if (wasListening && mode.current === 'conversation') startCapture();
    }
  }, []);

  // Never leave the mic on when the component goes away.
  useEffect(
    () => () => {
      mode.current = 'idle';
      capture.current?.abort();
      stopSpeaking();
    },
    [],
  );

  return {
    supported,
    listening,
    conversationOn,
    speaking,
    liveText,
    error,
    dismissError: () => setError(null),
    startHold,
    endHold,
    startConversation,
    stopConversation: () => stopConversation(),
    say,
  };
}

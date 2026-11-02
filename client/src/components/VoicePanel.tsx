import { useState, type FormEvent } from 'react';
import type { Settings } from '../hooks/useSettings';

interface Props {
  settings: Settings;
  onSettingsChange: (patch: Partial<Settings>) => void;
  voice: {
    supported: boolean;
    listening: boolean;
    conversationOn: boolean;
    speaking: boolean;
    liveText: string;
    error: string | null;
    dismissError: () => void;
    startHold: () => void;
    endHold: () => void;
    startConversation: () => void;
    stopConversation: () => void;
  };
  busy: boolean;
  aiError: string | null;
  onDismissAiError: () => void;
  reply: { text: string; question: string | null } | null;
  onBrainDump: (text: string) => Promise<unknown>;
}

export function VoicePanel({ settings, onSettingsChange, voice, busy, aiError, onDismissAiError, reply, onBrainDump }: Props) {
  const [dump, setDump] = useState('');
  const ptt = settings.voiceMode === 'push-to-talk';

  async function submitDump(e: FormEvent) {
    e.preventDefault();
    if (!dump.trim() || busy) return;
    const text = dump;
    setDump('');
    const result = await onBrainDump(text);
    if (result === null) setDump(text); // failed: give the text back so nothing is lost
  }

  function switchMode(mode: Settings['voiceMode']) {
    if (voice.conversationOn) voice.stopConversation();
    onSettingsChange({ voiceMode: mode });
  }

  return (
    <section aria-labelledby="voice-heading" className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <h2 id="voice-heading" className="font-semibold">
          Voice
        </h2>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={settings.tts}
            onChange={(e) => onSettingsChange({ tts: e.target.checked })}
            className="accent-indigo-600"
          />
          Speak replies
        </label>
      </div>

      {voice.supported ? (
        <>
          {/* Segmented control implemented as a radio group, so it's keyboard- and screen-reader-friendly. */}
          <fieldset className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-800">
            <legend className="sr-only">Voice mode</legend>
            {(
              [
                ['push-to-talk', 'Push to talk'],
                ['conversation', 'Conversation'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="cursor-pointer">
                <input
                  type="radio"
                  name="voice-mode"
                  value={value}
                  checked={settings.voiceMode === value}
                  onChange={() => switchMode(value)}
                  className="peer sr-only"
                />
                <span className="block rounded-md px-2 py-1.5 text-center font-medium text-slate-600 peer-checked:bg-white peer-checked:text-slate-900 peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-indigo-500 dark:text-slate-300 dark:peer-checked:bg-slate-950 dark:peer-checked:text-white">
                  {label}
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col items-center gap-2 py-2">
            {ptt ? (
              <button
                type="button"
                // Pointer events cover mouse, touch, and pen with one code path.
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  voice.startHold();
                }}
                onPointerUp={voice.endHold}
                onPointerCancel={voice.endHold}
                // Keyboard users: Enter/Space on the focused button toggles hold.
                onKeyDown={(e) => {
                  if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                    e.preventDefault();
                    voice.startHold();
                  }
                }}
                onKeyUp={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') voice.endHold();
                }}
                onContextMenu={(e) => e.preventDefault()}
                aria-label={voice.listening ? 'Listening. Release to send.' : 'Hold to talk'}
                aria-pressed={voice.listening}
                className={micClass(voice.listening)}
              >
                <MicIcon />
              </button>
            ) : (
              <button
                type="button"
                onClick={voice.conversationOn ? voice.stopConversation : voice.startConversation}
                aria-label={voice.conversationOn ? 'Stop listening' : 'Start conversation mode'}
                aria-pressed={voice.conversationOn}
                className={micClass(voice.conversationOn)}
              >
                <MicIcon />
              </button>
            )}
            <p className="text-center text-xs text-slate-500" aria-live="polite">
              {voice.speaking
                ? 'Speaking…'
                : busy
                  ? 'Thinking…'
                  : ptt
                    ? voice.listening
                      ? 'Listening, release to send'
                      : 'Hold the button (or hold Space) and talk'
                    : voice.conversationOn
                      ? voice.listening
                        ? 'Listening. Just talk; I send after a pause.'
                        : 'Paused'
                      : 'Tap to start listening'}
            </p>
          </div>

          {(voice.liveText || voice.listening) && (
            <div aria-label="Live transcript" className="min-h-10 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
              {voice.liveText || <span className="text-slate-400">…</span>}
            </div>
          )}
        </>
      ) : (
        <p role="note" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          This browser doesn't support speech recognition. Use Chrome or Edge on desktop for voice. The brain dump box below works everywhere.
        </p>
      )}

      {reply && (reply.text || reply.question) && (
        <div className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200">
          {reply.text && <p>{reply.text}</p>}
          {reply.question && <p className="mt-1 font-medium">{reply.question}</p>}
        </div>
      )}

      {[voice.error && { text: voice.error, dismiss: voice.dismissError }, aiError && { text: aiError, dismiss: onDismissAiError }]
        .filter((x): x is { text: string; dismiss: () => void } => Boolean(x))
        .map(({ text, dismiss }) => (
          <div key={text} role="alert" className="flex items-start justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
            <span>{text}</span>
            <button type="button" onClick={dismiss} aria-label="Dismiss" className="shrink-0">
              ✕
            </button>
          </div>
        ))}

      <form onSubmit={submitDump} className="flex flex-col gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <label htmlFor="brain-dump" className="text-sm font-medium">
          Brain dump
        </label>
        <textarea
          id="brain-dump"
          value={dump}
          onChange={(e) => setDump(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submitDump(e);
          }}
          rows={4}
          maxLength={20000}
          placeholder="Type everything on your mind: “lab due Friday, email Valencia tomorrow morning, groceries at some point…”"
          className="resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
        <button
          type="submit"
          disabled={!dump.trim() || busy}
          className="self-end rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? 'Extracting…' : 'Extract tasks'}
          <span className="sr-only"> (Ctrl+Enter)</span>
        </button>
      </form>

      {voice.supported && (
        <p className="text-xs text-slate-400">Speech is transcribed by your browser. In Chrome, audio is sent to Google for recognition.</p>
      )}
    </section>
  );
}

const micClass = (active: boolean) =>
  `flex h-20 w-20 touch-none select-none items-center justify-center rounded-full text-white shadow-md transition-colors ${
    active ? 'mic-pulse bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'
  }`;

function MicIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
    </svg>
  );
}

/** Fixed, always-visible indicator whenever the microphone is live. */
export function MicLiveBadge({ live }: { live: boolean }) {
  if (!live) return null;
  return (
    <div role="status" className="fixed left-1/2 top-2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow-lg">
      <span className="h-2 w-2 animate-pulse rounded-full bg-white motion-reduce:animate-none" aria-hidden />
      Microphone on
    </div>
  );
}

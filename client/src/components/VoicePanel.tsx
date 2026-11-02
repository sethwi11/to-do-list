import { useState, type FormEvent } from 'react';
import { CircleAlert, Mic, MicOff, Volume2, VolumeX, X } from 'lucide-react';
import type { Settings } from '../hooks/useSettings';

export interface VoiceControls {
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
}

interface Props {
  settings: Settings;
  onSettingsChange: (patch: Partial<Settings>) => void;
  voice: VoiceControls;
  busy: boolean;
  aiError: string | null;
  onDismissAiError: () => void;
  reply: { text: string; question: string | null } | null;
  onBrainDump: (text: string) => Promise<unknown>;
}

/** Status line under the mic, shared by the panel and the phone's floating button. */
export function voiceStatus(voice: VoiceControls, busy: boolean, ptt: boolean): string {
  if (voice.speaking) return 'Speaking…';
  if (busy) return 'Thinking…';
  if (ptt) return voice.listening ? 'Listening, release to send' : 'Hold to talk (or hold Space)';
  if (voice.conversationOn) return voice.listening ? 'Listening, I send after a pause' : 'Paused';
  return 'Tap to start listening';
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

  const errors = [
    voice.error && { text: voice.error, dismiss: voice.dismissError },
    aiError && { text: aiError, dismiss: onDismissAiError },
  ].filter((x): x is { text: string; dismiss: () => void } => Boolean(x));

  return (
    <section aria-labelledby="voice-heading" className="card flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="voice-heading" className="text-sm font-semibold">
          Capture
        </h2>
        <button
          type="button"
          onClick={() => onSettingsChange({ tts: !settings.tts })}
          aria-pressed={settings.tts}
          aria-label="Speak replies aloud"
          title={settings.tts ? 'Replies are spoken aloud' : 'Replies are muted'}
          className="icon-btn h-7 w-7"
        >
          {settings.tts ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
        </button>
      </div>

      {voice.supported ? (
        <>
          {/* Segmented control implemented as a radio group, so it's keyboard- and screen-reader-friendly. */}
          <fieldset className="grid grid-cols-2 rounded-lg bg-slate-100 p-0.5 text-xs dark:bg-slate-800">
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
                <span className="block rounded-md px-2 py-1 text-center font-medium text-slate-500 peer-checked:bg-white peer-checked:text-slate-900 peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-indigo-500 dark:text-slate-400 dark:peer-checked:bg-slate-950 dark:peer-checked:text-white">
                  {label}
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col items-center gap-2">
            <MicButton voice={voice} ptt={ptt} size="lg" />
            <p className="text-center text-xs text-slate-500" aria-live="polite">
              {voiceStatus(voice, busy, ptt)}
            </p>
          </div>

          {(voice.liveText || voice.listening) && (
            <p aria-label="Live transcript" className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
              {voice.liveText || <span className="text-slate-400">…</span>}
            </p>
          )}
        </>
      ) : (
        <p role="note" className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          <MicOff className="h-4 w-4 shrink-0" aria-hidden />
          Voice needs Chrome or Edge on desktop. You can still type below.
        </p>
      )}

      {reply && (reply.text || reply.question) && (
        <div className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-950 dark:bg-indigo-950/50 dark:text-indigo-100">
          {reply.text && <p>{reply.text}</p>}
          {reply.question && <p className="mt-0.5 font-medium">{reply.question}</p>}
        </div>
      )}

      {errors.map(({ text, dismiss }) => (
        <div key={text} role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950/50 dark:text-red-200">
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">{text}</span>
          <button type="button" onClick={dismiss} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100">
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ))}

      <form onSubmit={submitDump} className="group flex flex-col gap-2">
        <label htmlFor="brain-dump" className="sr-only">
          Brain dump
        </label>
        <textarea
          id="brain-dump"
          value={dump}
          onChange={(e) => setDump(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submitDump(e);
          }}
          rows={1}
          maxLength={20000}
          placeholder="Or type a brain dump…"
          // Grows from one line to a real text box while you're using it.
          className="field-sizing-content max-h-60 min-h-9 resize-none rounded-lg bg-slate-50 px-3 py-2 text-sm group-focus-within:min-h-24 dark:bg-slate-950"
        />
        {dump.trim() && (
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs text-slate-400">Ctrl+Enter</span>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? 'Extracting…' : 'Extract tasks'}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}

/** The mic button itself: hold-to-talk or a conversation toggle, depending on the mode. */
export function MicButton({ voice, ptt, size }: { voice: VoiceControls; ptt: boolean; size: 'lg' | 'fab' }) {
  const active = ptt ? voice.listening : voice.conversationOn;
  const className = `flex shrink-0 touch-none items-center justify-center rounded-full text-white transition-colors select-none ${
    size === 'lg' ? 'h-16 w-16' : 'h-14 w-14 shadow-lg shadow-indigo-500/30'
  } ${active ? 'mic-pulse bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'}`;
  const icon = <Mic className={size === 'lg' ? 'h-7 w-7' : 'h-6 w-6'} aria-hidden />;
  // In Chrome, recognition runs on Google's servers; say so where people decide to use it.
  const privacy = 'Speech is transcribed by your browser (Chrome sends audio to Google).';

  if (!ptt) {
    return (
      <button
        type="button"
        onClick={voice.conversationOn ? voice.stopConversation : voice.startConversation}
        aria-label={voice.conversationOn ? 'Stop listening' : 'Start conversation mode'}
        aria-pressed={voice.conversationOn}
        title={privacy}
        className={className}
      >
        {icon}
      </button>
    );
  }

  return (
    <button
      type="button"
      // Pointer events cover mouse, touch, and pen with one code path.
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        voice.startHold();
      }}
      onPointerUp={voice.endHold}
      onPointerCancel={voice.endHold}
      // Keyboard users: hold Enter/Space on the focused button.
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
      title={privacy}
      className={className}
    >
      {icon}
    </button>
  );
}

/**
 * Phones only: the capture panel sits below the task list there, so a
 * floating mic keeps voice one tap away, with a small status bubble above it.
 */
export function FloatingMic({ voice, ptt, busy, reply }: { voice: VoiceControls; ptt: boolean; busy: boolean; reply: Props['reply'] }) {
  if (!voice.supported) return null;
  const bubble = voice.error ?? (voice.listening || voice.liveText ? voice.liveText || '…' : busy ? 'Thinking…' : voice.speaking ? reply?.text : null);

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2 lg:hidden">
      {bubble && (
        <p aria-live="polite" className="max-w-[min(18rem,calc(100vw-2rem))] rounded-2xl bg-slate-900 px-3 py-2 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
          {bubble}
        </p>
      )}
      <MicButton voice={voice} ptt={ptt} size="fab" />
    </div>
  );
}

/** Fixed, always-visible indicator whenever the microphone is live. */
export function MicLiveBadge({ live }: { live: boolean }) {
  if (!live) return null;
  return (
    <div role="status" className="fixed top-2 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow-lg">
      <span className="h-2 w-2 animate-pulse rounded-full bg-white motion-reduce:animate-none" aria-hidden />
      Microphone on
    </div>
  );
}

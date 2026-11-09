import { useRef, useState } from 'react';
import { ExternalLink, Music, Pause, Play, SkipForward } from 'lucide-react';
import { apiFetch } from '../../api/client';
import { useApp } from '../../app/AppContext';
import { useAppSettings } from '../../data/useApplications';
import { cx } from '../../lib/cx';
import { Button, IconButton } from '../../ui/Button';
import { useReducedMotion } from '../../ui/useReducedMotion';

/** A block's soundtrack. Nothing loads until you press play: a link opens in a new tab; a folder plays here, through the local server. */
export function Soundtrack({ name }: { name: string }) {
  const { settings } = useAppSettings();
  const { openDialog, showToast } = useApp();
  const track = settings.soundtracks.find((s) => s.name === name);
  const audio = useRef<HTMLAudioElement>(null);
  const [tracks, setTracks] = useState<string[] | null>(null);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const still = useReducedMotion();
  const src = (n: number, list: string[]) => `/api/soundtracks/${encodeURIComponent(name)}/tracks/${encodeURIComponent(list[n % list.length]!)}`;

  if (!track || (!track.link && !track.folder)) {
    return (
      <Button variant="ghost" icon={Music} onClick={() => openDialog({ kind: 'settings' })} title="Add a link or a folder for it in Settings">
        {name}: add it in Settings
      </Button>
    );
  }
  if (!track.folder) {
    return (
      // noopener: the page we open must not get a handle back to this one.
      <a href={track.link!} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-control px-3 text-body font-medium text-ink hover:bg-accent-soft">
        <ExternalLink className="size-4" aria-hidden />
        Play {name}
      </a>
    );
  }

  async function toggle() {
    const el = audio.current!;
    if (playing) {
      el.pause();
      return setPlaying(false);
    }
    let list = tracks;
    if (!list) {
      try {
        list = await apiFetch<string[]>(`/soundtracks/${encodeURIComponent(name)}/tracks`);
      } catch {
        return showToast(`Couldn’t open the ${name} folder. Check it in Settings.`);
      }
      if (list.length === 0) return showToast(`No audio files in the ${name} folder.`);
      setTracks(list);
      el.src = src(0, list);
    }
    await el.play();
    setPlaying(true);
  }
  const next = () => {
    if (!tracks) return;
    setI(i + 1);
    audio.current!.src = src(i + 1, tracks);
    void audio.current!.play();
    setPlaying(true);
  };

  return (
    <span className="inline-flex items-center gap-1">
      <IconButton icon={playing ? Pause : Play} label={playing ? `Pause ${name}` : `Play ${name}`} onClick={() => void toggle()} />
      <span className="min-w-0 truncate text-meta text-ink-muted">{tracks ? tracks[i % tracks.length] : name}</span>
      {tracks && tracks.length > 1 && <IconButton icon={SkipForward} label="Next track" onClick={next} />}
      {/* Level bars: they move while playing, and hold still with reduced motion. */}
      <span aria-hidden className="flex h-3 items-end gap-0.5">
        {[0, 1, 2].map((b) => (
          <span key={b} className={cx('w-0.5 rounded-full bg-accent', playing && !still ? 'animate-levels' : 'h-1')} style={{ animationDelay: `${b * 0.2}s` }} />
        ))}
      </span>
      <audio ref={audio} onEnded={next} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} preload="none" />
    </span>
  );
}

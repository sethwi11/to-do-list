import { useEffect, useRef } from 'react';
import { useReducedMotion } from './useReducedMotion';

const COLORS = ['--accent-fill', '--cal-dusty-blue', '--cal-rose', '--cal-sage', '--cal-indigo'];

/** A few seconds of fireworks for a streak milestone (a still burst with reduced motion), then gone. Never confetti. */
export function Fireworks({ label, onDone }: { label: string; onDone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const still = useReducedMotion();

  useEffect(() => {
    const done = window.setTimeout(onDone, still ? 4000 : 3600);
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (still || !c || !ctx) return () => window.clearTimeout(done);
    c.width = innerWidth * devicePixelRatio;
    c.height = innerHeight * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    const css = getComputedStyle(document.documentElement);
    const colors = COLORS.map((v) => css.getPropertyValue(v).trim() || '#dcae1d');
    type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string };
    const sparks: Spark[] = [];
    const burst = (x: number, y: number) => {
      const color = colors[Math.floor(Math.random() * colors.length)]!;
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        const v = 2 + Math.random() * 2.5;
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color });
      }
    };
    const bursts = [0, 500, 1000, 1500].map((t, i) => window.setTimeout(() => burst(innerWidth * (0.25 + 0.5 * ((i * 0.37) % 1)), innerHeight * (0.25 + 0.15 * (i % 2))), t));
    let frame = requestAnimationFrame(function draw() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const s of sparks) {
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.05;
        s.vx *= 0.985;
        s.life -= 0.012;
        if (s.life <= 0) continue;
        ctx.globalAlpha = s.life;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      frame = requestAnimationFrame(draw);
    });
    return () => {
      window.clearTimeout(done);
      bursts.forEach((b) => window.clearTimeout(b));
      cancelAnimationFrame(frame);
    };
  }, [still, onDone]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center">
      {!still && <canvas ref={canvas} className="absolute inset-0 size-full" aria-hidden />}
      {still && (
        <svg viewBox="0 0 120 120" className="absolute size-56 text-accent" aria-hidden>
          {Array.from({ length: 16 }, (_, i) => (
            <line key={i} x1="60" y1="60" x2={60 + 50 * Math.cos((i * Math.PI) / 8)} y2={60 + 50 * Math.sin((i * Math.PI) / 8)} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 6" />
          ))}
        </svg>
      )}
      <p role="status" className="relative rounded-panel border border-hairline bg-surface px-5 py-3 font-display text-section shadow-popover">
        {label}
      </p>
    </div>
  );
}

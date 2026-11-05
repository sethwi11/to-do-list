import { Section, Stage } from './shared';

const row = 'grid items-baseline gap-x-6 gap-y-1 border-b border-hairline py-4 sm:grid-cols-[180px_1fr]';
const spec = 'text-meta text-ink-muted';

export function Typography() {
  return (
    <Section
      id="type"
      title="Type"
      intro="Three families: Fraunces for headings and dates, Instrument Sans for everything you read and click, JetBrains Mono for anything that is a number or a time."
    >
      <div>
        <div className={row}>
          <p className={spec}>
            Page title<span className="block font-mono">text-page · Fraunces 400 · 40/1.15 · −0.02em</span>
          </p>
          <p className="font-display text-page">Wednesday</p>
        </div>
        <div className={row}>
          <p className={spec}>
            Today's date line<span className="block font-mono">text-section · Fraunces · 22</span>
          </p>
          <p className="font-display text-section text-ink-muted">November 4</p>
        </div>
        <div className={row}>
          <p className={spec}>
            Section header<span className="block font-mono">text-section · Fraunces · 22</span>
          </p>
          <p className="font-display text-section">Upcoming this week</p>
        </div>
        <div className={row}>
          <p className={spec}>
            App name, empty states<span className="block font-mono">font-display italic</span>
          </p>
          <p className="font-display text-section italic">Planner</p>
        </div>
        <div className={row}>
          <p className={spec}>
            Item title<span className="block font-mono">text-title · Instrument Sans · 16</span>
          </p>
          <p className="text-title">Interview with Acme, final round</p>
        </div>
        <div className={row}>
          <p className={spec}>
            Body<span className="block font-mono">text-body · 14/1.5 · 400 and 500</span>
          </p>
          <p className="max-w-[62ch] text-body">
            Finish the data structures problem set and submit it before the 11:59 PM deadline. <span className="font-medium">Medium weight</span> is for buttons and emphasis; 600 is only for small labels.
          </p>
        </div>
        <div className={row}>
          <p className={spec}>
            Metadata, captions<span className="block font-mono">text-meta · 13 · ink-muted</span>
          </p>
          <p className="text-meta text-ink-muted">Added Monday · School · 3 subtasks</p>
        </div>
        <div className={row}>
          <p className={spec}>
            Label<span className="block font-mono">text-label uppercase · 11 · 600 · +0.08em</span>
          </p>
          <p className="text-label text-ink-muted uppercase">Today · Overdue · Up next</p>
        </div>
        <div className={row}>
          <p className={spec}>
            Times, counts<span className="block font-mono">font-mono · tabular numbers</span>
          </p>
          <p className="font-mono text-meta tabular-nums">
            9 AM &nbsp; 2:30 PM &nbsp; 2/4 &nbsp; 25m &nbsp; WK 45
          </p>
        </div>
        <div className={row}>
          <p className={spec}>
            Focus timer<span className="block font-mono">text-timer · mono · 96</span>
          </p>
          <p className="font-mono text-timer tabular-nums max-sm:text-[64px]">25:00</p>
        </div>
      </div>

      <Stage>
        <h3 className="mb-4 text-label text-ink-muted uppercase">Spacing, radii, shadow, motion</h3>
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <p className={`${spec} mb-2`}>Spacing: a 4px scale</p>
            <ul className="space-y-1.5">
              {[1, 2, 3, 4, 6, 8, 12, 16].map((n) => (
                <li key={n} className="flex items-center gap-3 font-mono text-time text-ink-muted">
                  <span className="w-14">{n * 4}px</span>
                  <span aria-hidden className="h-2 bg-accent" style={{ width: `${n * 4}px` }} />
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-6">
            <div>
              <p className={`${spec} mb-2`}>Corners</p>
              <div className="flex items-end gap-4">
                <div className="grid size-16 place-items-center border border-rule font-mono text-time text-ink-muted rounded-control">4px</div>
                <div className="grid size-16 place-items-center border border-rule font-mono text-time text-ink-muted rounded-panel">8px</div>
                <div className="grid size-8 place-items-center rounded-full bg-accent-ink font-mono text-time text-on-accent">12</div>
              </div>
              <p className={`${spec} mt-2`}>Controls and blocks 4px, popovers 8px. Nothing rounder, except the circular today marker.</p>
            </div>
            <div>
              <p className={`${spec} mb-2`}>Shadow: popovers, menus, and modals only</p>
              <div className="grid h-14 max-w-48 place-items-center rounded-panel border border-hairline bg-surface font-mono text-time text-ink-muted shadow-popover">shadow-popover</div>
            </div>
            <div>
              <p className={`${spec} mb-2`}>Motion</p>
              <ul className="space-y-0.5 font-mono text-time text-ink-muted">
                <li>150ms ease-out: hover, focus, toggles</li>
                <li>180ms fade + 4px slide: popovers, modals</li>
                <li>250ms: the strike-through draws</li>
                <li>+400ms: the row fades and collapses</li>
                <li>reduced motion: all of it off</li>
              </ul>
            </div>
          </div>
        </div>
      </Stage>
    </Section>
  );
}

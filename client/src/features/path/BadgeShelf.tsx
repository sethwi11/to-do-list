import { CalendarCheck, Code, Flag, Flame, LockOpen, PiggyBank, Send, type LucideIcon } from 'lucide-react';
import type { Badge } from '@todo/shared';
import { longDate } from '../../lib/dates';
import { badgeHooks } from '../../data/usePath';
import { SectionLabel } from '../../ui/fields';

const ICONS: [string, LucideIcon][] = [['streak', Flame], ['week', CalendarCheck], ['leetcode', Code], ['applications', Send], ['goal', PiggyBank], ['milestone', Flag], ['stage', LockOpen]];
const iconFor = (key: string) => ICONS.find(([prefix]) => key.startsWith(prefix))?.[1] ?? Flag;

/** Every badge earned, newest first, each with the day it was earned. */
export function BadgeShelf() {
  const badges = badgeHooks.useList().data ?? [];
  const shelf: Badge[] = [...badges].sort((a, b) => b.earnedOn.localeCompare(a.earnedOn) || b.createdAt.localeCompare(a.createdAt));
  return (
    <section aria-label="Badges">
      <SectionLabel count={shelf.length} className="mb-2">Badges</SectionLabel>
      {shelf.length === 0 ? (
        <p className="text-meta text-ink-muted">Badges come from real work: a streak, a full week of check-ins, every 25 LeetCode sessions, every 10 applications, each quarter of a savings goal, a milestone reached. None yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {shelf.map((b) => {
            const Icon = iconFor(b.key);
            return (
              <li key={b.id} className="flex flex-col gap-2 border border-rule bg-surface p-3">
                <span aria-hidden className="grid size-9 place-items-center border border-rule bg-accent-soft text-ink">
                  <Icon className="size-[18px]" />
                </span>
                <span className="font-display text-title leading-tight">{b.title}</span>
                <span className="font-mono text-time text-ink-muted">{longDate(b.earnedOn)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

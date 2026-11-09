import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { earnedBadges } from '@todo/shared';
import { badgesApi } from '../../api/entities';
import { useApp } from '../../app/AppContext';
import { useAppSettings } from '../../data/useApplications';
import { checkInHooks, focusSessionHooks } from '../../data/useCheckIns';
import { goalHooks, moneyMoveHooks } from '../../data/useMoney';
import { badgeHooks, milestoneHooks } from '../../data/usePath';
import { toLocalISODate } from '../../lib/dates';
import { Fireworks } from '../../ui/Fireworks';
import { usePlanSources } from '../today/useTodayPlan';

// Keys being sent (or that failed to save), so a re-render can't send one twice.
const sent = new Set<string>();

/** Saves each badge the data has earned that isn't saved yet, and plays the fireworks for one earned today. Renders nothing else. */
export function BadgeAwards() {
  const { today, applications, loading, applicationsLoading } = useApp();
  const { src, routine } = usePlanSources();
  const qc = useQueryClient();
  const checkIns = checkInHooks.useList().data;
  const sessions = focusSessionHooks.useList().data;
  const goals = goalHooks.useList().data;
  const moves = moneyMoveHooks.useList().data;
  const milestones = milestoneHooks.useList().data;
  const stored = badgeHooks.useList().data;
  const { settings, loading: settingsLoading } = useAppSettings();
  const [celebrate, setCelebrate] = useState<string | null>(null);

  // Wait until everything they read has loaded: a half-loaded list could give a badge the wrong date, and it's kept for good.
  const missing = useMemo(() => {
    if (!checkIns || !sessions || !goals || !moves || !milestones || !stored || loading || applicationsLoading || routine.loading || settingsLoading) return [];
    const have = new Set(stored.map((b) => b.key));
    const focusDates = new Set(sessions.map((s) => toLocalISODate(new Date(s.startedAt))));
    return earnedBadges({ src, checkIns, focusDates, applications, goals, moves, milestones, birthday: settings.path.birthday, today }).filter((b) => !have.has(b.key));
  }, [src, checkIns, sessions, goals, moves, milestones, stored, applications, settings.path.birthday, today, loading, applicationsLoading, routine.loading, settingsLoading]);

  useEffect(() => {
    const fresh = missing.filter((b) => !sent.has(b.key));
    if (fresh.length === 0) return;
    fresh.forEach((b) => sent.add(b.key));
    void Promise.allSettled(fresh.map((b) => badgesApi.create({ id: crypto.randomUUID(), ...b })))
      .then(async (results) => {
        await qc.invalidateQueries({ queryKey: badgeHooks.key });
        // Saved ones can be earned again later (a reopened milestone); a failed one stays blocked, so a broken save can't retry forever.
        results.forEach((r, i) => r.status === 'fulfilled' && sent.delete(fresh[i]!.key));
      });
    // Badges from earlier days are filed quietly; only one earned today gets the fireworks.
    const now = fresh.filter((b) => b.earnedOn === today);
    if (now.length > 0) setCelebrate(now.length === 1 ? `Badge: ${now[0]!.title}` : `${now.length} new badges`);
  }, [missing, today, qc]);

  return celebrate ? <Fireworks label={celebrate} onDone={() => setCelebrate(null)} /> : null;
}

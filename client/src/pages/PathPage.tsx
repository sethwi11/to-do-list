import { PageHeader } from '../app/PageHeader';
import { useApp } from '../app/AppContext';
import { useAppSettings } from '../data/useApplications';
import { BadgeShelf } from '../features/path/BadgeShelf';
import { Milestones } from '../features/path/Milestones';
import { NorthStar } from '../features/path/NorthStar';
import { Stages } from '../features/path/Stages';

/** The Path: where this is going, the stages on the way, the milestones with the inputs feeding them, and the badges earned. */
export default function PathPage() {
  const { today } = useApp();
  const { settings } = useAppSettings();
  return (
    <div className="max-w-[900px]">
      <PageHeader title="Path" subtitle="Where this is going" />
      <div className="space-y-12">
        <NorthStar path={settings.path} today={today} />
        <Stages path={settings.path} today={today} />
        <Milestones today={today} />
        <BadgeShelf />
      </div>
    </div>
  );
}

import type { ViewId } from '../lib/taskViews';

const copy: Record<ViewId, { title: string; hint: string }> = {
  today: {
    title: 'Nothing due today',
    hint: 'Add a task above. It will be due today by default. Soon you will be able to just say it out loud.',
  },
  all: {
    title: 'No tasks yet',
    hint: 'Type your first task in the box above and press Enter.',
  },
};

export function EmptyState({ view }: { view: ViewId }) {
  const { title, hint } = copy[view];
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
    </div>
  );
}

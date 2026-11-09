import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CopyPlus, Plus, Settings2 } from 'lucide-react';
import { activeTemplate, classTitle, fitAround, openBumps, weeklyClashes, type RoutineBlock } from '@todo/shared';
import type { BlockFields } from '../actions/useRoutineActions';
import { MissedList, weekOf } from '../features/today/MissedList';
import { formatTimeRange } from '../features/calendar/format';
import { useNowText, usePlanSources } from '../features/today/useTodayPlan';
import { useApp } from '../app/AppContext';
import { BlockDialog, type BlockDialogState } from '../features/week/BlockDialog';
import { TemplateDialog, type TemplateDialogState } from '../features/week/TemplateDialog';
import { WeekGrid, type ClassSlot, type Slot } from '../features/week/WeekGrid';
import { WEEKDAY_NAME, longDate } from '../lib/dates';
import { Button } from '../ui/Button';
import { Label, Select } from '../ui/fields';
import { Dialog } from '../ui/Panel';
import { Segmented } from '../ui/Segmented';
import { EmptyState, SkeletonRows } from '../ui/states';
import { WeekdayPicker } from '../ui/WeekdayPicker';

const isPhone = () => typeof matchMedia === 'function' && matchMedia('(max-width: 767px)').matches;
const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: String(d), label: WEEKDAY_NAME[d]!.slice(0, 2), title: WEEKDAY_NAME[d] }));

/** My week: the routine template as a grid, Monday first. Drag to move or stretch a block; click one to edit it. */
export default function WeekPage() {
  const { today, courses, semesters, calendarsById } = useApp();
  const { src, routine } = usePlanSources();
  const { templates, blocks } = routine;
  const now = useNowText();
  const bumps = useMemo(() => openBumps(src, ...weekOf(now.slice(0, 10))), [src, now]);
  const [params, setParams] = useSearchParams();
  const [day, setDay] = useState<number | null>(() => (isPhone() ? new Date().getDay() : null));
  const [blockDialog, setBlockDialog] = useState<BlockDialogState | null>(null);
  const [templateDialog, setTemplateDialog] = useState<TemplateDialogState | null>(null);
  const [copyDay, setCopyDay] = useState<number | null>(null);

  const template = templates.find((t) => t.id === params.get('template')) ?? activeTemplate(templates, today) ?? templates[0];
  const templateBlocks = useMemo(() => blocks.filter((b) => b.templateId === template?.id), [blocks, template]);

  // Classes from Courses whose semester overlaps the template's dates, for reference.
  const classes = useMemo<ClassSlot[]>(() => {
    if (!template) return [];
    const inRange = new Set(semesters.filter((s) => !s.archived && s.endDate >= template.effectiveFrom && (template.effectiveTo === null || s.startDate <= template.effectiveTo)).map((s) => s.id));
    return courses.filter((c) => inRange.has(c.semesterId)).flatMap((c) => c.meetingDays.map((weekday) => ({ key: `class:${c.id}:${weekday}`, title: classTitle(c), weekday, start: c.startTime, end: c.endTime, color: c.color })));
  }, [template, semesters, courses]);

  // A class that overlaps a block every week means the template doesn't match the class time.
  const clashes = useMemo(() => weeklyClashes(templateBlocks, classes), [templateBlocks, classes]);
  function fitClash(c: (typeof clashes)[number]) {
    const changes = c.blockIds.flatMap((id) => {
      const block = templateBlocks.find((b) => b.id === id)!;
      const others = classes.filter((x) => x.weekday === block.weekday && !(x.title === c.classTitle && x.start === c.classStart));
      const fit = fitAround(block, { start: c.classStart, end: c.classEnd }, others);
      return fit ? [{ block, ...fit }] : [];
    });
    if (changes.length > 0) void routine.retimeBlocks(changes, `${c.blockTitle} now fits around ${c.classTitle}`);
  }

  // Today's agenda links here with ?block= to edit that block.
  const linked = params.get('block');
  useEffect(() => {
    const block = linked ? blocks.find((b) => b.id === linked) : undefined;
    if (!block) return;
    setBlockDialog({ mode: 'edit', block });
    setParams((p) => {
      p.delete('block');
      p.set('template', block.templateId);
      return p;
    }, { replace: true });
  }, [linked, blocks, setParams]);

  async function saveBlock(fields: BlockFields, copyTo: number[], existing?: RoutineBlock) {
    const saved = await routine.saveBlock(fields, existing);
    if (saved && copyTo.length > 0) await routine.copyBlocks([saved], copyTo.map((weekday) => ({ weekday })), `Copied “${saved.title}” to ${copyTo.length} more ${copyTo.length === 1 ? 'day' : 'days'}`);
    return saved !== null;
  }

  if (routine.loading) return <SkeletonRows count={6} />;

  if (!template) {
    return (
      <div>
        <h1 className="mb-6 font-display text-page">Week</h1>
        <EmptyState message="No week template yet. A template is the routine you follow every week, with the dates it applies to.">
          <Button variant="primary" icon={Plus} onClick={() => setTemplateDialog({ mode: 'new' })}>
            New template
          </Button>
        </EmptyState>
        <TemplateDialog state={templateDialog} onClose={() => setTemplateDialog(null)} onSave={async (f) => (await routine.saveTemplate(f)) !== null} onDelete={() => {}} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col [&>*]:shrink-0">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-page leading-none">Week</h1>
          <p className="mt-1 text-meta text-ink-muted">
            {templates.length > 1 ? (
              <Select aria-label="Template" value={template.id} wrapperClassName="inline-block" className="h-7 w-auto" onChange={(e) => setParams({ template: e.target.value })}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            ) : (
              <span className="font-medium text-ink">{template.name}</span>
            )}{' '}
            · {longDate(template.effectiveFrom)} to {template.effectiveTo ? longDate(template.effectiveTo) : 'no end date'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" icon={Plus} onClick={() => setBlockDialog({ mode: 'new', defaults: { templateId: template.id, weekday: day ?? 1, start: '09:00', end: '10:00' } })}>
            New block
          </Button>
          <Button variant="secondary" icon={Settings2} onClick={() => setTemplateDialog({ mode: 'edit', template })}>
            Template
          </Button>
          <Button variant="secondary" icon={CopyPlus} onClick={() => setTemplateDialog({ mode: 'duplicate', template })}>
            Duplicate
          </Button>
        </div>
      </header>

      {clashes.map((c) => (
        <div key={`${c.classTitle}|${c.blockTitle}|${c.classStart}`} role="status" className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-panel border border-rule bg-surface px-4 py-2.5">
          <p className="text-body">
            {c.classTitle.split(' ').slice(0, 2).join(' ')} overlaps {c.blockTitle} every {c.weekdays.map((w) => WEEKDAY_NAME[w]).join(' and ')}. Adjust the template?
            <span className="block text-meta text-ink-muted">
              From Courses: {c.classTitle} meets {c.weekdays.map((w) => WEEKDAY_NAME[w]!.slice(0, 3)).join(', ')} {formatTimeRange(c.classStart, c.classEnd)}.
            </span>
          </p>
          <Button variant="secondary" onClick={() => fitClash(c)}>
            Fit {c.blockTitle} around the class
          </Button>
        </div>
      ))}

      {day !== null && <Segmented label="Day" value={String(day)} onChange={(v) => setDay(Number(v))} options={DAY_OPTIONS} className="mb-3 self-start" />}

      <div className="min-h-[30rem] flex-1 shrink!">
        <WeekGrid
          blocks={templateBlocks}
          classes={classes}
          calendarsById={calendarsById}
          day={day}
          onOpen={(block) => setBlockDialog({ mode: 'edit', block })}
          onCreate={(slot: Slot) => setBlockDialog({ mode: 'new', defaults: { templateId: template.id, ...slot } })}
          onMove={(block, slot) => routine.moveBlock(block, slot)}
          onCopyDay={setCopyDay}
        />
      </div>
      <p className="mt-2 text-meta text-ink-muted">Classes come from Courses. Where two blocks overlap, the stronger one (commitment, then high) takes the time and shows “+1 hidden”; the hidden block comes back on a day the stronger one is skipped.</p>
      {bumps.length > 0 && (
        <div className="mt-4 max-h-56 overflow-y-auto">
          <MissedList bumps={bumps} src={src} now={now} />
        </div>
      )}

      <BlockDialog
        state={blockDialog}
        onClose={() => setBlockDialog(null)}
        onSave={saveBlock}
        onDelete={(b) => void routine.deleteBlock(b)}
        onDuplicate={(b) => void routine.copyBlocks([b], [{ weekday: b.weekday }], `Duplicated “${b.title}”`)}
      />
      <TemplateDialog
        state={templateDialog}
        onClose={() => setTemplateDialog(null)}
        onDelete={(t) => void routine.deleteTemplate(t)}
        onSave={async (fields) => {
          if (templateDialog?.mode === 'duplicate') {
            const copy = await routine.duplicateTemplate(templateDialog.template, fields);
            if (copy) setParams({ template: copy.id });
            return copy !== null;
          }
          const saved = await routine.saveTemplate(fields, templateDialog?.mode === 'edit' ? templateDialog.template : undefined);
          if (saved) setParams({ template: saved.id });
          return saved !== null;
        }}
      />
      <CopyDayDialog
        weekday={copyDay}
        onClose={() => setCopyDay(null)}
        onCopy={(targets) => {
          const source = templateBlocks.filter((b) => b.weekday === copyDay);
          void routine.copyBlocks(source, targets.map((weekday) => ({ weekday })), `Copied ${WEEKDAY_NAME[copyDay!]}’s ${source.length} blocks to ${targets.length} more ${targets.length === 1 ? 'day' : 'days'}`);
        }}
      />
    </div>
  );
}

function CopyDayDialog({ weekday, onClose, onCopy }: { weekday: number | null; onClose: () => void; onCopy: (targets: number[]) => void }) {
  const [targets, setTargets] = useState<number[]>([]);
  useEffect(() => setTargets([]), [weekday]);
  return (
    <Dialog
      open={weekday !== null}
      onClose={onClose}
      title={weekday === null ? '' : `Copy ${WEEKDAY_NAME[weekday]}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={targets.length === 0} onClick={() => { onCopy(targets); onClose(); }}>
            Copy
          </Button>
        </>
      }
    >
      <Label>Add a copy of every block on</Label>
      <WeekdayPicker value={targets} onChange={setTargets} mondayFirst disabled={weekday === null ? [] : [weekday]} />
      <p className="mt-3 text-meta text-ink-muted">Blocks already on those days stay. Undo removes the copies.</p>
    </Dialog>
  );
}

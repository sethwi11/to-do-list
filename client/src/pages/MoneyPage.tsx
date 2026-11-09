import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useMoney } from '../actions/useMoneyActions';
import { PageHeader } from '../app/PageHeader';
import { useApp } from '../app/AppContext';
import { useAppSettings } from '../data/useApplications';
import { MoneyDialogs, type MoneyDialog } from '../features/money/MoneyDialogs';
import { SavingsTab } from '../features/money/SavingsTab';
import { SpendingTab } from '../features/money/SpendingTab';
import { Tabs } from '../ui/Tabs';
import { SkeletonRows } from '../ui/states';

const TABS = [
  { id: 'spending', label: 'Spending' },
  { id: 'savings', label: 'Savings and investments' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** Money: a spending budget, the leftover put to work, savings goals and investments. Tracking only: you type everything, and nothing is advice. */
export default function MoneyPage() {
  const { today } = useApp();
  const money = useMoney();
  const { settings } = useAppSettings();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<TabId>('spending');
  const [dialog, setDialog] = useState<MoneyDialog | null>(null);
  // The New menu's "Expense" lands here with ?add=1: show the quick-add row and focus it, once.
  const [focusAdd, setFocusAdd] = useState(params.has('add'));
  useEffect(() => {
    if (!params.has('add')) return;
    setTab('spending');
    setFocusAdd(true);
    setParams((p) => {
      p.delete('add');
      return p;
    }, { replace: true });
  }, [params, setParams]);

  return (
    <div className="max-w-[900px]">
      <PageHeader title="Money" subtitle={tab === 'spending' ? 'What you spend' : 'What you keep'} />
      <Tabs label="Money" tabs={TABS} value={tab} onChange={setTab} className="mb-8" />
      {money.loading ? (
        <SkeletonRows count={6} />
      ) : tab === 'spending' ? (
        <SpendingTab money={money} budget={settings.budget} today={today} focusAdd={focusAdd} open={setDialog} />
      ) : (
        <SavingsTab money={money} today={today} open={setDialog} />
      )}
      <MoneyDialogs dialog={dialog} onClose={() => setDialog(null)} money={money} />
    </div>
  );
}

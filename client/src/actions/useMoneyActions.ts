import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { formatCents, planMove, type Allocation, type CreateExpenseInput, type Expense, type ExpenseCategory, type Holding, type MoneyMove, type MoveTarget, type SavingsGoal, type UnsettledPeriod, type UpdateExpenseInput } from '@todo/shared';
import { ApiError } from '../api/client';
import { expenseCategoriesApi, expensesApi, holdingsApi, moneyMovesApi, savingsGoalsApi } from '../api/entities';
import { useApp } from '../app/AppContext';
import { expenseCategoryHooks, expenseHooks, goalHooks, holdingHooks, moneyMoveHooks } from '../data/useMoney';

const messageOf = (err: unknown) => (err instanceof ApiError ? err.message : 'Unexpected error');
const NONE: never[] = [];
const strip = <T extends { id: string; createdAt: string }>({ id: _i, createdAt: _c, ...rest }: T) => rest;

export type ExpenseFields = Omit<CreateExpenseInput, 'id'> & Pick<Expense, 'amountCents' | 'what' | 'date' | 'kind' | 'recurring' | 'categoryId'>;
export type GoalFields = Pick<SavingsGoal, 'name' | 'targetCents'>;
export type HoldingFields = Pick<Holding, 'name' | 'type' | 'valueCents' | 'valueUpdatedOn' | 'monthlyTargetCents'>;
export interface PutIn {
  toType: Exclude<MoveTarget, 'kept'>;
  toId: string;
  amountCents: number;
  date: string;
  note: string | null;
}

/** All the money data and everything that changes it, each change with Undo. */
export function useMoney() {
  const { showToast, today } = useApp();
  const qc = useQueryClient();
  const categoriesQ = expenseCategoryHooks.useList();
  const expensesQ = expenseHooks.useList();
  const goalsQ = goalHooks.useList();
  const holdingsQ = holdingHooks.useList();
  const movesQ = moneyMoveHooks.useList();
  const createExpense = expenseHooks.useCreate();
  const updateExpense = expenseHooks.useUpdate();
  const removeExpense = expenseHooks.useDelete();
  const createGoal = goalHooks.useCreate();
  const updateGoal = goalHooks.useUpdate();
  const removeGoal = goalHooks.useDelete();
  const createHolding = holdingHooks.useCreate();
  const updateHolding = holdingHooks.useUpdate();
  const removeHolding = holdingHooks.useDelete();
  const createCategory = expenseCategoryHooks.useCreate();
  const updateCategory = expenseCategoryHooks.useUpdate();
  const removeCategory = expenseCategoryHooks.useDelete();

  const refresh = useCallback(
    (...keys: (readonly string[])[]) => Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey }))),
    [qc],
  );
  const attempt = useCallback(
    async <T,>(what: string, run: () => Promise<T>): Promise<T | null> => {
      try {
        return await run();
      } catch (err) {
        showToast(`Couldn’t ${what}: ${messageOf(err)}`);
        return null;
      }
    },
    [showToast],
  );
  /** An Undo that runs `run`, then refreshes what it touched. */
  const undo = useCallback(
    (keys: (readonly string[])[], run: () => Promise<unknown>) => () => void run().then(() => refresh(...keys)).catch((err: unknown) => showToast(`Couldn’t undo that: ${messageOf(err)}`)),
    [refresh, showToast],
  );

  // ---- expenses ----
  const addExpense = useCallback(
    async (fields: ExpenseFields) => {
      const e = await attempt('add that expense', () => createExpense.mutateAsync(fields));
      if (e) showToast(`Added ${formatCents(e.amountCents)} · ${e.what}`, () => void removeExpense.mutateAsync(e.id).catch((err: unknown) => showToast(`Couldn’t undo that: ${messageOf(err)}`)));
      return e;
    },
    [attempt, createExpense, removeExpense, showToast],
  );
  const saveExpense = useCallback(
    async (existing: Expense, changes: UpdateExpenseInput) => {
      const previous = strip(existing) as UpdateExpenseInput;
      const e = await attempt('save that expense', () => updateExpense.mutateAsync({ id: existing.id, changes }));
      if (e) showToast(`Saved ${formatCents(e.amountCents)} · ${e.what}`, undo([expenseHooks.key], () => expensesApi.update(existing.id, previous)));
      return e;
    },
    [attempt, updateExpense, showToast, undo],
  );
  const deleteExpense = useCallback(
    async (e: Expense) => {
      const done = await attempt('delete that expense', () => removeExpense.mutateAsync(e.id));
      if (done !== null) showToast(`Deleted ${formatCents(e.amountCents)} · ${e.what}`, undo([expenseHooks.key], () => expensesApi.restore(e.id)));
    },
    [attempt, removeExpense, showToast, undo],
  );

  // ---- goals ----
  const saveGoal = useCallback(
    async (fields: GoalFields, existing?: SavingsGoal) => {
      if (!existing) {
        const g = await attempt('add the goal', () => createGoal.mutateAsync(fields));
        if (g) showToast(`Added “${g.name}”`, undo([goalHooks.key], () => savingsGoalsApi.remove(g.id)));
        return g;
      }
      const previous = { name: existing.name, targetCents: existing.targetCents };
      const g = await attempt('save the goal', () => updateGoal.mutateAsync({ id: existing.id, changes: fields }));
      if (g) showToast(`Saved “${g.name}”`, undo([goalHooks.key], () => savingsGoalsApi.update(existing.id, previous)));
      return g;
    },
    [attempt, createGoal, updateGoal, showToast, undo],
  );
  const deleteGoal = useCallback(
    async (g: SavingsGoal) => {
      const done = await attempt('delete the goal', () => removeGoal.mutateAsync(g.id));
      if (done !== null) showToast(`Deleted “${g.name}”`, undo([goalHooks.key], () => savingsGoalsApi.restore(g.id)));
    },
    [attempt, removeGoal, showToast, undo],
  );

  // ---- holdings ----
  const saveHolding = useCallback(
    async (fields: HoldingFields, existing?: Holding) => {
      if (!existing) {
        const h = await attempt('add the holding', () => createHolding.mutateAsync(fields));
        if (h) showToast(`Added “${h.name}”`, undo([holdingHooks.key], () => holdingsApi.remove(h.id)));
        return h;
      }
      const previous = { name: existing.name, type: existing.type, valueCents: existing.valueCents, valueUpdatedOn: existing.valueUpdatedOn, monthlyTargetCents: existing.monthlyTargetCents };
      const h = await attempt('save the holding', () => updateHolding.mutateAsync({ id: existing.id, changes: fields }));
      if (h) showToast(`Saved “${h.name}”`, undo([holdingHooks.key], () => holdingsApi.update(existing.id, previous)));
      return h;
    },
    [attempt, createHolding, updateHolding, showToast, undo],
  );
  const deleteHolding = useCallback(
    async (h: Holding) => {
      const done = await attempt('delete the holding', () => removeHolding.mutateAsync(h.id));
      if (done !== null) showToast(`Deleted “${h.name}”`, undo([holdingHooks.key], () => holdingsApi.restore(h.id)));
    },
    [attempt, removeHolding, showToast, undo],
  );

  // ---- money in: to a goal or a holding ----
  const putIn = useCallback(
    async (p: PutIn) => {
      const m = await attempt('add that money', () => moneyMovesApi.create({ id: crypto.randomUUID(), date: p.date, periodStart: null, toType: p.toType, toId: p.toId, amountCents: p.amountCents, note: p.note }));
      await refresh(moneyMoveHooks.key);
      if (m) showToast(`Added ${formatCents(m.amountCents)}`, undo([moneyMoveHooks.key], () => moneyMovesApi.remove(m.id)));
      return m;
    },
    [attempt, refresh, showToast, undo],
  );
  const removeMove = useCallback(
    async (m: MoneyMove) => {
      const done = await attempt('remove that entry', () => moneyMovesApi.remove(m.id));
      await refresh(moneyMoveHooks.key);
      if (done !== null) showToast(`Removed ${formatCents(m.amountCents)}`, undo([moneyMoveHooks.key], () => moneyMovesApi.batch({ put: [m], remove: [] })));
    },
    [attempt, refresh, showToast, undo],
  );

  /** "Move it": split a finished period's leftover between goals and holdings (the rest is kept as cash, which settles it). One Undo takes all of it back. */
  const moveLeftover = useCallback(
    async (period: UnsettledPeriod, allocations: Allocation[]): Promise<string | null> => {
      const plan = planMove(period.remainingCents, allocations);
      if ('error' in plan) return plan.error;
      const now = new Date().toISOString();
      const put: MoneyMove[] = plan.rows.map((r) => ({ id: crypto.randomUUID(), date: today, periodStart: period.period.start, toType: r.toType, toId: r.toId, amountCents: r.amountCents, note: null, createdAt: now }));
      const done = await attempt('move that', () => moneyMovesApi.batch({ put, remove: [] }));
      await refresh(moneyMoveHooks.key);
      if (!done) return 'Couldn’t move that.';
      showToast(`Moved ${formatCents(put.filter((m) => m.toType !== 'kept').reduce((n, m) => n + m.amountCents, 0))}`, undo([moneyMoveHooks.key], () => moneyMovesApi.batch({ put: [], remove: put.map((m) => m.id) })));
      return null;
    },
    [attempt, refresh, showToast, today, undo],
  );

  // ---- categories ----
  const addCategory = useCallback(
    async (name: string) => {
      const c = await attempt('add the category', () => createCategory.mutateAsync({ name }));
      if (c) showToast(`Added “${c.name}”`, undo([expenseCategoryHooks.key], () => expenseCategoriesApi.remove(c.id)));
      return c;
    },
    [attempt, createCategory, showToast, undo],
  );
  const renameCategory = useCallback(
    async (c: ExpenseCategory, name: string) => {
      const done = await attempt('rename it', () => updateCategory.mutateAsync({ id: c.id, changes: { name } }));
      if (done) showToast(`Renamed to “${name}”`, undo([expenseCategoryHooks.key], () => expenseCategoriesApi.update(c.id, { name: c.name })));
      return done !== null;
    },
    [attempt, updateCategory, showToast, undo],
  );
  const deleteCategory = useCallback(
    async (c: ExpenseCategory) => {
      const done = await attempt('delete the category', () => removeCategory.mutateAsync(c.id));
      await refresh(expenseHooks.key);
      // Its expenses keep their amounts and just lose the category; Undo brings the category back, not the link.
      if (done !== null) showToast(`Deleted “${c.name}”. Its expenses are now uncategorized`, undo([expenseCategoryHooks.key], () => expenseCategoriesApi.create({ id: c.id, name: c.name })));
    },
    [attempt, removeCategory, refresh, showToast, undo],
  );

  const categories = categoriesQ.data ?? NONE;
  return {
    categories,
    categoriesById: useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]),
    expenses: expensesQ.data ?? NONE,
    goals: goalsQ.data ?? NONE,
    holdings: holdingsQ.data ?? NONE,
    moves: movesQ.data ?? NONE,
    loading: categoriesQ.isPending || expensesQ.isPending || goalsQ.isPending || holdingsQ.isPending || movesQ.isPending,
    addExpense,
    saveExpense,
    deleteExpense,
    saveGoal,
    deleteGoal,
    saveHolding,
    deleteHolding,
    putIn,
    removeMove,
    moveLeftover,
    addCategory,
    renameCategory,
    deleteCategory,
  };
}

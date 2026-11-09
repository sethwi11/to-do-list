import { z } from 'zod';
import { hasFields, LocalDateSchema, NO_FIELDS_MESSAGE } from '../localTime';

// Money is whole cents everywhere. Nothing here holds a bank balance or an account number: you type in what you spend.

/** A positive amount in cents (up to $10 million). */
export const CentsSchema = z.number().int().min(1).max(1_000_000_000);

export const ExpenseCategoryFieldsSchema = z.object({ name: z.string().trim().min(1).max(60) });
export const ExpenseCategorySchema = ExpenseCategoryFieldsSchema.extend({ id: z.uuid(), sortOrder: z.number(), createdAt: z.iso.datetime() });
export const CreateExpenseCategoryInputSchema = ExpenseCategoryFieldsSchema.extend({ id: z.uuid().optional() });
export const UpdateExpenseCategoryInputSchema = ExpenseCategoryFieldsSchema.partial().refine(hasFields, NO_FIELDS_MESSAGE);
export type ExpenseCategory = z.infer<typeof ExpenseCategorySchema>;
export type CreateExpenseCategoryInput = z.infer<typeof CreateExpenseCategoryInputSchema>;
export type UpdateExpenseCategoryInput = z.infer<typeof UpdateExpenseCategoryInputSchema>;

/** The nine categories a fresh database starts with. */
export const DEFAULT_EXPENSE_CATEGORIES = ['Food', 'Eating out', 'Gas and transport', 'Shopping', 'Subscriptions', 'School', 'Going out', 'Business (real estate)', 'Other'] as const;

export const EXPENSE_KINDS = ['need', 'want'] as const;
export const ExpenseKindSchema = z.enum(EXPENSE_KINDS);
export type ExpenseKind = z.infer<typeof ExpenseKindSchema>;

export const ExpenseFieldsSchema = z.object({
  amountCents: CentsSchema,
  what: z.string().trim().min(1).max(200),
  categoryId: z.uuid().nullable(),
  date: LocalDateSchema,
  kind: ExpenseKindSchema,
  /** Repeats every month (a subscription, say): it shows in the recurring costs. */
  recurring: z.boolean(),
});
export const ExpenseSchema = ExpenseFieldsSchema.extend({ id: z.uuid(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() });
export const CreateExpenseInputSchema = ExpenseFieldsSchema.partial({ categoryId: true, kind: true, recurring: true }).extend({ id: z.uuid().optional() });
export const UpdateExpenseInputSchema = ExpenseFieldsSchema.partial().refine(hasFields, NO_FIELDS_MESSAGE);
export type Expense = z.infer<typeof ExpenseSchema>;
export type CreateExpenseInput = z.infer<typeof CreateExpenseInputSchema>;
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseInputSchema>;

export const SavingsGoalFieldsSchema = z.object({ name: z.string().trim().min(1).max(80), targetCents: CentsSchema });
export const SavingsGoalSchema = SavingsGoalFieldsSchema.extend({ id: z.uuid(), sortOrder: z.number(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() });
export const CreateSavingsGoalInputSchema = SavingsGoalFieldsSchema.extend({ id: z.uuid().optional() });
export const UpdateSavingsGoalInputSchema = SavingsGoalFieldsSchema.partial().refine(hasFields, NO_FIELDS_MESSAGE);
export type SavingsGoal = z.infer<typeof SavingsGoalSchema>;
export type CreateSavingsGoalInput = z.infer<typeof CreateSavingsGoalInputSchema>;
export type UpdateSavingsGoalInput = z.infer<typeof UpdateSavingsGoalInputSchema>;

export const HOLDING_TYPES = ['stock', 'etf', 'crypto', 'savings', 'real-estate', 'other'] as const;
export const HoldingTypeSchema = z.enum(HOLDING_TYPES);
export type HoldingType = z.infer<typeof HoldingTypeSchema>;

export const HoldingFieldsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: HoldingTypeSchema,
  /** What it's worth now, as you last typed it. 0 is fine. */
  valueCents: z.number().int().min(0).max(100_000_000_000),
  /** The day you last updated that value. */
  valueUpdatedOn: LocalDateSchema,
  /** An optional monthly amount to put in ("$25 of $50 this month"). */
  monthlyTargetCents: CentsSchema.nullable(),
});
export const HoldingSchema = HoldingFieldsSchema.extend({ id: z.uuid(), sortOrder: z.number(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() });
export const CreateHoldingInputSchema = HoldingFieldsSchema.partial({ monthlyTargetCents: true }).extend({ id: z.uuid().optional() });
export const UpdateHoldingInputSchema = HoldingFieldsSchema.partial().refine(hasFields, NO_FIELDS_MESSAGE);
export type Holding = z.infer<typeof HoldingSchema>;
export type CreateHoldingInput = z.infer<typeof CreateHoldingInputSchema>;
export type UpdateHoldingInput = z.infer<typeof UpdateHoldingInputSchema>;

/** Where a move of money went: a savings goal, a holding, or "kept" (left as cash, which settles a period's leftover). */
export const MOVE_TARGETS = ['goal', 'holding', 'kept'] as const;
export const MoveTargetSchema = z.enum(MOVE_TARGETS);
export type MoveTarget = z.infer<typeof MoveTargetSchema>;

const targetMatchesId = (v: { toType: MoveTarget; toId: string | null }) => (v.toType === 'kept') === (v.toId === null);
const TARGET_REFINE = { message: 'A goal or holding needs its id; "kept" has none', path: ['toId'] };
export const MoneyMoveFieldsSchema = z.object({
  date: LocalDateSchema,
  /** The first day of the budget period whose leftover this came from; null for money you add yourself. */
  periodStart: LocalDateSchema.nullable(),
  toType: MoveTargetSchema,
  toId: z.uuid().nullable(),
  amountCents: CentsSchema,
  note: z.string().trim().max(200).nullable(),
});
export const MoneyMoveSchema = MoneyMoveFieldsSchema.extend({ id: z.uuid(), createdAt: z.iso.datetime() }).refine(targetMatchesId, TARGET_REFINE);
export const CreateMoneyMoveInputSchema = MoneyMoveFieldsSchema.partial({ periodStart: true, note: true }).extend({ id: z.uuid().optional() }).refine(targetMatchesId, TARGET_REFINE);
/** "Move it" writes several rows at once, and Undo removes them again. */
export const MoneyMoveBatchInputSchema = z.object({ put: z.array(MoneyMoveSchema).max(100), remove: z.array(z.uuid()).max(100) });
export type MoneyMove = z.infer<typeof MoneyMoveSchema>;
export type CreateMoneyMoveInput = z.infer<typeof CreateMoneyMoveInputSchema>;
export type MoneyMoveBatchInput = z.infer<typeof MoneyMoveBatchInputSchema>;

/** The monthly (or weekly) spending budget; 0 means none set yet. */
export const BUDGET_PERIODS = ['month', 'week'] as const;
export const BudgetSettingsSchema = z.object({ amountCents: z.number().int().min(0).max(1_000_000_000), period: z.enum(BUDGET_PERIODS) });
export type BudgetSettings = z.infer<typeof BudgetSettingsSchema>;
export const DEFAULT_BUDGET: BudgetSettings = { amountCents: 0, period: 'month' };

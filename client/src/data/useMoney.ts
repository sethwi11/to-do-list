import type { CreateExpenseCategoryInput, CreateExpenseInput, CreateHoldingInput, CreateMoneyMoveInput, CreateSavingsGoalInput, Expense, ExpenseCategory, Holding, MoneyMove, SavingsGoal, UpdateExpenseCategoryInput, UpdateExpenseInput, UpdateHoldingInput, UpdateSavingsGoalInput } from '@todo/shared';
import { expenseCategoriesApi, expensesApi, holdingsApi, moneyMovesApi, savingsGoalsApi } from '../api/entities';
import { createEntityHooks } from './entityHooks';

export const expenseCategoryHooks = createEntityHooks<ExpenseCategory, CreateExpenseCategoryInput, UpdateExpenseCategoryInput>('expense-categories', expenseCategoriesApi);
export const expenseHooks = createEntityHooks<Expense, CreateExpenseInput, UpdateExpenseInput>('expenses', expensesApi);
export const goalHooks = createEntityHooks<SavingsGoal, CreateSavingsGoalInput, UpdateSavingsGoalInput>('savings-goals', savingsGoalsApi);
export const holdingHooks = createEntityHooks<Holding, CreateHoldingInput, UpdateHoldingInput>('holdings', holdingsApi);
export const moneyMoveHooks = createEntityHooks<MoneyMove, CreateMoneyMoveInput, never>('money-moves', moneyMovesApi);

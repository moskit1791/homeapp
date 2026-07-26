import type { BudgetCategory, BudgetMonthDetail, FinanceDebt, FinanceSavingsAccount } from '../api';

export type FinanceEntity =
  | 'budget-category'
  | 'budget-item'
  | 'expense'
  | 'income'
  | 'finance-debt'
  | 'finance-debt-payment'
  | 'finance-savings-account'
  | 'finance-savings-transaction';

type EncryptPayload = <T>(module: 'finances', entity: string, payload: T) => Promise<string>;

type DecryptPayload = <T>(module: 'finances', entity: string, payload: string) => T;

export async function sealFinanceEnvelope<T>(
  entity: FinanceEntity,
  payload: T,
  options: { encryptPayload: EncryptPayload; keyVersion: number | null | undefined }
): Promise<{ encryptedPayload: string; encryptionVersion: number }> {
  if (!options.keyVersion) {
    throw new Error('Brak aktywnego klucza szyfrowania domu.');
  }

  return {
    encryptedPayload: await options.encryptPayload('finances', entity, payload),
    encryptionVersion: options.keyVersion
  };
}

export function decryptBudgetCategories(
  categories: BudgetCategory[],
  decryptPayload: DecryptPayload
): BudgetCategory[] {
  return categories.map((category) => {
    if (!category.encryptedPayload) {
      return category;
    }

    const payload = decryptOrFallback<{ name: string }>(
      decryptPayload,
      'budget-category',
      category.encryptedPayload,
      { name: 'Nie można odszyfrować kategorii' }
    );

    return { ...category, name: payload.name };
  });
}

export function decryptBudgetMonthDetail(
  detail: BudgetMonthDetail,
  decryptPayload: DecryptPayload
): BudgetMonthDetail {
  const categories = detail.categories.map((category) => {
    const categoryPayload = category.encryptedPayload
      ? decryptOrFallback<{ name: string }>(
          decryptPayload,
          'budget-category',
          category.encryptedPayload,
          { name: 'Nie można odszyfrować kategorii' }
        )
      : { name: category.name };
    const items = category.items.map((item) => {
      const itemPayload = item.encryptedPayload
        ? decryptOrFallback<{ budgetAmount: number | null; name: string }>(
            decryptPayload,
            'budget-item',
            item.encryptedPayload,
            { budgetAmount: null, name: 'Nie można odszyfrować pozycji' }
          )
        : { budgetAmount: nullableNumber(item.budgetAmount), name: item.name };
      const expenses = item.expenses.map((expense) => {
        const expensePayload = expense.encryptedPayload
          ? decryptOrFallback<{
              amount: number;
              name?: string;
              occurredAt?: string;
              originalAmount?: number | string;
              originalCurrency?: string;
            }>(decryptPayload, 'expense', expense.encryptedPayload, {
              amount: 0
            })
          : {
              amount: Number(expense.amount),
              name: expense.name ?? undefined,
              occurredAt: expense.occurredAt ?? undefined,
              originalAmount: expense.originalAmount ?? undefined,
              originalCurrency: expense.originalCurrency ?? undefined
            };

        return {
          ...expense,
          amount: money(expensePayload.amount),
          name: expensePayload.name?.trim() || expense.name?.trim() || 'Wydatek',
          occurredAt: expensePayload.occurredAt ?? expense.occurredAt ?? expense.createdAt,
          originalAmount:
            expensePayload.originalAmount === undefined
              ? (expense.originalAmount ?? null)
              : money(Number(expensePayload.originalAmount)),
          originalCurrency: expensePayload.originalCurrency ?? expense.originalCurrency ?? null,
          source: expense.source ?? 'manual',
          sourceExternalId: expense.sourceExternalId ?? null
        };
      });
      const spent = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
      const remaining = itemPayload.budgetAmount === null ? null : itemPayload.budgetAmount - spent;

      return {
        ...item,
        budgetAmount: itemPayload.budgetAmount === null ? null : money(itemPayload.budgetAmount),
        expenses,
        name: itemPayload.name,
        remainingAmount: remaining === null ? null : money(remaining),
        spentAmount: money(spent)
      };
    });

    return { ...category, items, name: categoryPayload.name };
  });
  const incomes = detail.incomes.map((income) => {
    const payload = income.encryptedPayload
      ? decryptOrFallback<{ amount: number }>(decryptPayload, 'income', income.encryptedPayload, {
          amount: 0
        })
      : { amount: Number(income.amount) };

    return { ...income, amount: money(payload.amount) };
  });
  const personSummary = detail.personSummary.map((person) => {
    const income = incomes.find((entry) => entry.ownerMemberId === person.ownerMemberId);
    const items = categories
      .flatMap((category) => category.items)
      .filter((item) => item.owner.memberId === person.ownerMemberId);
    const budget = items.reduce((sum, item) => sum + Number(item.budgetAmount ?? 0), 0);
    const spent = items.reduce((sum, item) => sum + Number(item.spentAmount), 0);

    return {
      ...person,
      incomeAmount: income?.amount ?? '0.00',
      totalBudgetAmount: money(budget),
      totalRemainingAmount: money(budget - spent),
      totalSpentAmount: money(spent)
    };
  });
  const summary = personSummary.reduce(
    (total, person) => ({
      incomeAmount: money(Number(total.incomeAmount) + Number(person.incomeAmount)),
      totalBudgetAmount: money(Number(total.totalBudgetAmount) + Number(person.totalBudgetAmount)),
      totalRemainingAmount: money(
        Number(total.totalRemainingAmount) + Number(person.totalRemainingAmount)
      ),
      totalSpentAmount: money(Number(total.totalSpentAmount) + Number(person.totalSpentAmount))
    }),
    {
      incomeAmount: '0.00',
      totalBudgetAmount: '0.00',
      totalRemainingAmount: '0.00',
      totalSpentAmount: '0.00'
    }
  );

  return { ...detail, categories, incomes, personSummary, summary };
}

export function decryptFinanceDebts(
  debts: FinanceDebt[],
  decryptPayload: DecryptPayload
): FinanceDebt[] {
  return debts.map((debt) => {
    const debtPayload = debt.encryptedPayload
      ? decryptOrFallback<{
          amount: number;
          lenderName: string;
          note: string | null;
          purpose: string;
        }>(decryptPayload, 'finance-debt', debt.encryptedPayload, {
          amount: 0,
          lenderName: 'Nie można odszyfrować pożyczkodawcy',
          note: null,
          purpose: 'Nie można odszyfrować celu'
        })
      : {
          amount: Number(debt.amount),
          lenderName: debt.lenderName,
          note: debt.note,
          purpose: debt.purpose
        };
    const payments = debt.payments.map((payment) => {
      const payload = payment.encryptedPayload
        ? decryptOrFallback<{ amount: number; note: string | null }>(
            decryptPayload,
            'finance-debt-payment',
            payment.encryptedPayload,
            { amount: 0, note: null }
          )
        : { amount: Number(payment.amount), note: payment.note };

      return { ...payment, amount: money(payload.amount), note: payload.note };
    });
    const paid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

    return {
      ...debt,
      ...debtPayload,
      amount: money(debtPayload.amount),
      paidAmount: money(paid),
      payments,
      remainingAmount: money(Math.max(0, debtPayload.amount - paid))
    };
  });
}

export function decryptFinanceSavings(
  accounts: FinanceSavingsAccount[],
  decryptPayload: DecryptPayload
): FinanceSavingsAccount[] {
  return accounts.map((account) => {
    const accountPayload = account.encryptedPayload
      ? decryptOrFallback<{ currentAmount?: number; name: string; targetAmount: number | null }>(
          decryptPayload,
          'finance-savings-account',
          account.encryptedPayload,
          { currentAmount: 0, name: 'Nie można odszyfrować celu', targetAmount: null }
        )
      : {
          currentAmount: Number(account.currentAmount),
          name: account.name,
          targetAmount: nullableNumber(account.targetAmount)
        };
    const transactions = account.transactions.map((transaction) => {
      const payload = transaction.encryptedPayload
        ? decryptOrFallback<{ amount: number; note: string | null }>(
            decryptPayload,
            'finance-savings-transaction',
            transaction.encryptedPayload,
            { amount: 0, note: null }
          )
        : { amount: Number(transaction.amount), note: transaction.note };

      return { ...transaction, amount: money(payload.amount), note: payload.note };
    });
    const current =
      transactions.length > 0
        ? transactions.reduce(
            (sum, transaction) =>
              sum + (transaction.direction === 'add' ? 1 : -1) * Number(transaction.amount),
            0
          )
        : (accountPayload.currentAmount ?? 0);

    return {
      ...account,
      currentAmount: money(Math.max(0, current)),
      name: accountPayload.name,
      targetAmount:
        accountPayload.targetAmount === null ? null : money(accountPayload.targetAmount),
      transactions
    };
  });
}

function decryptOrFallback<T>(
  decryptPayload: DecryptPayload,
  entity: FinanceEntity,
  payload: string,
  fallback: T
): T {
  try {
    return decryptPayload<T>('finances', entity, payload);
  } catch {
    return fallback;
  }
}

function nullableNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function money(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

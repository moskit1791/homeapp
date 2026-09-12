import type { FinanceDebt } from '../api';

import { it, expect, describe } from 'vitest';

import {
  groupDebtsByLender,
  resolveBudgetItemIcon,
  summarizeBudgetCategories,
  resolveBudgetItemCategories,
} from './finance';

describe('automatyczny dobór ikon pozycji budżetu', () => {
  it.each([
    ['rata', 'solar:hand-money-bold-duotone'],
    ['Woda', 'solar:waterdrops-bold-duotone'],
    ['śmieci', 'solar:trash-bin-trash-bold-duotone'],
    ['Przedszkole', 'solar:notebook-bold-duotone'],
    ['Sanok prezent', 'solar:gift-bold-duotone'],
    ['spłata auta', 'solar:hand-money-bold-duotone'],
    ['kot', 'solar:heart-bold'],
    ['Emerytura Rodziców', 'solar:piggy-bank-bold-duotone'],
  ])('dobiera semantyczną ikonę dla „%s”', (name, expected) => {
    expect(resolveBudgetItemIcon(name)).toBe(expected);
  });

  it('korzysta z nazwy kategorii i stabilnego fallbacku dla własnych nazw', () => {
    expect(resolveBudgetItemIcon('Maja lutcza', 'Dzieci')).toBe(
      'solar:users-group-rounded-bold-duotone'
    );
    expect(resolveBudgetItemIcon('Nietypowa pozycja')).toBe(
      resolveBudgetItemIcon('Nietypowa pozycja')
    );
  });
});

function debt(
  id: string,
  lenderName: string,
  remainingAmount: string,
  extra: Partial<FinanceDebt> = {}
): FinanceDebt {
  return {
    id,
    lenderName,
    remainingAmount,
    amount: remainingAmount,
    paidAmount: '0',
    purpose: id,
    isSettled: false,
    dueDate: null,
    note: null,
    payments: [],
    householdId: 'test-household',
    createdAt: '',
    updatedAt: '',
    settledAt: null,
    encryptedPayload: null,
    encryptionVersion: null,
    ...extra,
  };
}

describe('pożyczki grupowane jak w aplikacji mobilnej', () => {
  it('łączy pożyczki Dzieci w jeden box i sumuje pozostałe kwoty', () => {
    const loans = [
      debt('skarpetki', 'Dzieci', '410'),
      debt('ciężary', 'Malwinka', '1100'),
      debt('siłownia', ' dzieci ', '1450'),
    ];
    const groups = groupDebtsByLender(loans);
    expect(
      groups.map(({ label, totalOpen, activeCount }) => ({ label, totalOpen, activeCount }))
    ).toEqual([
      { label: 'Dzieci', totalOpen: 1860, activeCount: 2 },
      { label: 'Malwinka', totalOpen: 1100, activeCount: 1 },
    ]);
    expect(groups[0].debts).toEqual([loans[2], loans[0]]);
    expect(groups[0].debts[0]).toBe(loans[2]);
  });

  it('zachowuje spłacone pożyczki, ale nie dolicza ich do należności', () => {
    const groups = groupDebtsByLender([
      debt('spłacona', 'Dzieci', '500', { isSettled: true }),
      debt('bez terminu', 'Dzieci', '80'),
      debt('z terminem', 'Dzieci', '20', { dueDate: '2026-10-01' }),
    ]);
    expect(groups[0]).toMatchObject({ totalOpen: 100, activeCount: 2, settledCount: 1 });
    expect(groups[0].debts.map(({ id }) => id)).toEqual(['z terminem', 'bez terminu', 'spłacona']);
  });

  it('obsługuje pustą listę i brak nazwy pożyczkodawcy', () => {
    expect(groupDebtsByLender([])).toEqual([]);
    expect(groupDebtsByLender([debt('a', '  ', '10'), debt('b', '', '20')])[0]).toMatchObject({
      label: 'Bez nazwy',
      activeCount: 2,
      totalOpen: 30,
    });
  });
});

describe('podsumowanie przefiltrowanego budżetu', () => {
  it('liczy liczby wyłącznie z widocznych pozycji', () => {
    const summary = summarizeBudgetCategories([
      {
        items: [
          { budgetAmount: '100', spentAmount: '60' },
          { budgetAmount: '50', spentAmount: '55' },
        ],
      },
    ]);

    expect(summary).toEqual({ budget: 150, spent: 115, remaining: 35, usage: 77, itemCount: 2 });
  });

  it('bezpiecznie obsługuje brak budżetu i wartości nieliczbowe', () => {
    expect(
      summarizeBudgetCategories([{ items: [{ budgetAmount: null, spentAmount: 'błąd' }] }])
    ).toEqual({ budget: 0, spent: 0, remaining: 0, usage: 0, itemCount: 1 });
  });
});

describe('kategorie dostępne przy dodawaniu pozycji budżetu', () => {
  it('udostępnia domyślne kategorie z bieżącego miesiąca w nowym domu', () => {
    const defaultCategories = [
      { id: 'fixed', isActive: true, name: 'Koszty stałe' },
      { id: 'other', isActive: true, name: 'Pozostałe' },
    ];

    expect(resolveBudgetItemCategories(defaultCategories, [])).toEqual(defaultCategories);
  });

  it('łączy kategorie miesiąca z katalogiem bez duplikatów i pomija nieaktywne', () => {
    const visible = [{ id: 'fixed', isActive: true, name: 'Koszty stałe' }];
    const catalog = [
      { id: 'fixed', isActive: true, name: 'Koszty stałe' },
      { id: 'custom', isActive: true, name: 'Wakacje' },
      { id: 'archived', isActive: false, name: 'Archiwum' },
    ];

    expect(resolveBudgetItemCategories(visible, catalog).map(({ id }) => id)).toEqual([
      'fixed',
      'custom',
    ]);
  });
});

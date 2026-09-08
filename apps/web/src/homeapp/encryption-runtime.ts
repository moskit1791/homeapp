import type { EncryptableModuleKey } from '@homeapp/shared-types';

import { openJson, sealJson } from './encryption-crypto';

type JsonRecord = Record<string, unknown>;

const state: { dataKey: Uint8Array | null; enabledModules: Set<EncryptableModuleKey>; keyVersion: number | null } = {
  dataKey: null,
  enabledModules: new Set(),
  keyVersion: null,
};
const cache = new Map<string, JsonRecord>();
const entityModules: Record<string, EncryptableModuleKey> = {
  attachment: 'attachments',
  'annual-cost': 'annual_costs',
  'annual-cost-history': 'annual_costs',
  'budget-category': 'finances',
  'budget-item': 'finances',
  'calendar-event': 'calendar',
  'cleaning-task': 'cleaning',
  'data-entry': 'data_entries',
  expense: 'finances',
  'finance-debt': 'finances',
  'finance-debt-payment': 'finances',
  'finance-savings-account': 'finances',
  'finance-savings-transaction': 'finances',
  income: 'finances',
  'meal-idea': 'meal_planner',
  'meal-plan-entry': 'meal_planner',
  'note-item': 'notes',
  'shopping-item': 'shopping',
  'todo-item': 'todo',
};

export function configureRuntimeEncryption(input: { dataKey: Uint8Array | null; enabledModules: EncryptableModuleKey[]; keyVersion: number | null }) {
  const changed = state.dataKey !== input.dataKey || state.keyVersion !== input.keyVersion;
  state.dataKey = input.dataKey;
  state.enabledModules = new Set(input.enabledModules);
  state.keyVersion = input.keyVersion;
  if (changed) cache.clear();
}

export function isRuntimeModuleEncrypted(module: EncryptableModuleKey) { return state.enabledModules.has(module); }

export async function encryptRuntimePayload<T>(
  module: EncryptableModuleKey,
  entity: string,
  payload: T
) {
  if (!state.dataKey || !state.keyVersion) {
    throw new Error('Odblokuj szyfrowanie, aby zapisać dane w tym module.');
  }
  return {
    encryptedPayload: await sealJson(payload, state.dataKey, `homeapp:${module}:${entity}`),
    encryptionVersion: state.keyVersion,
  };
}

export async function prepareEncryptedApiBody<T>(path: string, method: string, body: T): Promise<T> {
  if (!body || typeof body !== 'object') return body;
  const record = body as JsonRecord;
  if (method === 'POST' && path === '/attachments/upload-url' && state.enabledModules.has('attachments')) {
    const extensions: Record<string, string> = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
    return { ...record, fileName: `plik${extensions[String(record.mimeType)] ?? ''}` } as T;
  }
  if (method === 'PATCH' && /^\/meal-plans\/[^/]+$/.test(path) && Array.isArray(record.entries) && state.enabledModules.has('meal_planner')) {
    return { ...record, entries: await Promise.all(record.entries.map((entry) => encryptRecord('meal_planner', 'meal-plan-entry', entry as JsonRecord, ['mealName', 'linkUrl', 'note'], { mealName: '[Zaszyfrowany posiłek]', linkUrl: null, note: null }))) } as T;
  }
  if (method === 'POST' && path === '/calendar/events') return maybeEncrypt(body, 'calendar', 'calendar-event', ['title', 'locationName', 'locationUrl', 'note'], { title: '[Zaszyfrowane wydarzenie]', locationName: null, locationUrl: null, note: null });
  const calendarId = path.match(/^\/calendar\/events\/([^/]+)$/)?.[1];
  if (method === 'PATCH' && calendarId) return maybeEncrypt(body, 'calendar', 'calendar-event', ['title', 'locationName', 'locationUrl', 'note'], { title: '[Zaszyfrowane wydarzenie]', locationName: null, locationUrl: null, note: null }, calendarId);

  const routes: Array<[boolean, EncryptableModuleKey, string, string[], JsonRecord, string?]> = [
    [method === 'POST' && path === '/finance/categories', 'finances', 'budget-category', ['name'], { name: '[Zaszyfrowana kategoria]' }],
    [method === 'PATCH' && /^\/finance\/categories\/[^/]+$/.test(path), 'finances', 'budget-category', ['name'], { name: '[Zaszyfrowana kategoria]' }, path.split('/').at(-1)],
    [method === 'POST' && path === '/finance/budget-items', 'finances', 'budget-item', ['name', 'budgetAmount'], { name: '[Zaszyfrowana pozycja]', budgetAmount: null }],
    [method === 'PATCH' && /^\/finance\/budget-items\/[^/]+$/.test(path), 'finances', 'budget-item', ['name', 'budgetAmount'], { name: '[Zaszyfrowana pozycja]', budgetAmount: null }, path.split('/').at(-1)],
    [method === 'POST' && path === '/finance/expenses', 'finances', 'expense', ['name', 'amount', 'occurredAt', 'originalAmount', 'originalCurrency'], { name: null, amount: 0 }],
    [method === 'PUT' && /^\/finance\/incomes\/[^/]+$/.test(path), 'finances', 'income', ['amount'], { amount: 0 }, path.split('/').at(-1)],
    [method === 'POST' && path === '/finance/debts', 'finances', 'finance-debt', ['amount', 'lenderName', 'purpose', 'note'], { amount: 0, lenderName: '[Zaszyfrowane]', purpose: '[Zaszyfrowane]', note: null }],
    [method === 'PATCH' && /^\/finance\/debts\/[^/]+$/.test(path), 'finances', 'finance-debt', ['amount', 'lenderName', 'purpose', 'note'], { amount: 0, lenderName: '[Zaszyfrowane]', purpose: '[Zaszyfrowane]', note: null }, path.split('/').at(-1)],
    [method === 'POST' && /^\/finance\/debts\/[^/]+\/payments$/.test(path), 'finances', 'finance-debt-payment', ['amount', 'note'], { amount: 0, note: null }],
    [method === 'POST' && path === '/finance/savings', 'finances', 'finance-savings-account', ['name', 'amount', 'targetAmount'], { name: '[Zaszyfrowany cel]', amount: 0, targetAmount: null }],
    [method === 'POST' && /^\/finance\/savings\/[^/]+\/transactions$/.test(path), 'finances', 'finance-savings-transaction', ['amount', 'note'], { amount: 0, note: null }],
    [method === 'POST' && path === '/meal-ideas', 'meal_planner', 'meal-idea', ['title', 'linkUrl', 'note'], { title: '[Zaszyfrowany pomysł]', linkUrl: null, note: null }],
    [method === 'POST' && path === '/todo-items', 'todo', 'todo-item', ['title', 'description'], { title: '[Zaszyfrowane zadanie]', description: '' }],
    [method === 'POST' && path === '/notes', 'notes', 'note-item', ['title', 'description'], { title: '[Zaszyfrowana notatka]', description: '' }],
    [method === 'POST' && path === '/cleaning', 'cleaning', 'cleaning-task', ['name', 'location'], { name: '[Zaszyfrowane sprzątanie]', location: null }],
    [method === 'POST' && path === '/annual-costs', 'annual_costs', 'annual-cost', ['name', 'defaultAmount'], { name: '[Zaszyfrowany koszt]', defaultAmount: null }],
    [method === 'POST' && /^\/annual-costs\/[^/]+\/complete$/.test(path), 'annual_costs', 'annual-cost-history', ['amount'], { amount: null }],
    [method === 'POST' && path === '/data-entries', 'data_entries', 'data-entry', ['title', 'value'], { title: '[Zaszyfrowany wpis]', value: '[Zaszyfrowane]' }],
    [method === 'POST' && path === '/attachments', 'attachments', 'attachment', ['fileName', 'caption'], { fileName: 'zaszyfrowany-plik', caption: '' }],
    [method === 'POST' && /^\/shopping-lists\/[^/]+\/items$/.test(path), 'shopping', 'shopping-item', ['name', 'quantity', 'category', 'expirationDate'], { name: '[Zaszyfrowany produkt]', quantity: '', category: null, expirationDate: null }],
  ];
  for (const [matches, module, entity, fields, placeholders, id] of routes) if (matches) return maybeEncrypt(body, module, entity, fields, placeholders, id);

  const updates: Array<[RegExp, EncryptableModuleKey, string, string[], JsonRecord]> = [
    [/^\/meal-ideas\/([^/]+)$/, 'meal_planner', 'meal-idea', ['title', 'linkUrl', 'note'], { title: '[Zaszyfrowany pomysł]', linkUrl: null, note: null }],
    [/^\/todo-items\/([^/]+)$/, 'todo', 'todo-item', ['title', 'description'], { title: '[Zaszyfrowane zadanie]', description: '' }],
    [/^\/notes\/([^/]+)$/, 'notes', 'note-item', ['title', 'description'], { title: '[Zaszyfrowana notatka]', description: '' }],
    [/^\/cleaning\/([^/]+)$/, 'cleaning', 'cleaning-task', ['name', 'location'], { name: '[Zaszyfrowane sprzątanie]', location: null }],
    [/^\/data-entries\/([^/]+)$/, 'data_entries', 'data-entry', ['title', 'value'], { title: '[Zaszyfrowany wpis]', value: '[Zaszyfrowane]' }],
    [/^\/attachments\/([^/]+)$/, 'attachments', 'attachment', ['fileName', 'caption'], { fileName: 'zaszyfrowany-plik', caption: '' }],
    [/^\/shopping-lists\/items\/([^/]+)$/, 'shopping', 'shopping-item', ['name', 'quantity', 'category', 'expirationDate'], { name: '[Zaszyfrowany produkt]', quantity: '', category: null, expirationDate: null }],
  ];
  if (method === 'PATCH') for (const [pattern, module, entity, fields, placeholders] of updates) {
    const id = path.match(pattern)?.[1];
    if (id) return maybeEncrypt(body, module, entity, fields, placeholders, id);
  }
  return body;
}

export function transformEncryptedApiResponse<T>(value: T): T { return visit(value) as T; }

async function maybeEncrypt<T>(body: T, module: EncryptableModuleKey, entity: string, fields: string[], placeholders: JsonRecord, id?: string): Promise<T> {
  if (!state.enabledModules.has(module)) return body;
  return encryptRecord(module, entity, body as JsonRecord, fields, placeholders, id) as T;
}

async function encryptRecord(module: EncryptableModuleKey, entity: string, body: JsonRecord, fields: string[], placeholders: JsonRecord, id?: string) {
  if (!state.dataKey || !state.keyVersion) throw new Error('Odblokuj szyfrowanie, aby zapisać dane w tym module.');
  const current = id ? cache.get(`${entity}:${id}`) : undefined;
  const payload: JsonRecord = {};
  for (const field of fields) payload[field] = body[field] !== undefined ? body[field] : current?.[field] ?? null;
  return { ...body, ...placeholders, encryptedPayload: await sealJson(payload, state.dataKey, `homeapp:${module}:${entity}`), encryptionVersion: state.keyVersion };
}

function visit(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(visit);
  if (!value || typeof value !== 'object') return value;
  const source = value as JsonRecord;
  let result: JsonRecord = { ...source };
  const entity = typeof source.encryptionEntity === 'string' ? source.encryptionEntity : null;
  const payload = typeof source.encryptedPayload === 'string' ? source.encryptedPayload : null;
  if (entity && payload && entityModules[entity] && state.dataKey) {
    try {
      const privateFields = openJson<JsonRecord>(payload, state.dataKey, `homeapp:${entityModules[entity]}:${entity}`);
      result = { ...result, ...privateFields };
      if (typeof source.id === 'string') cache.set(`${entity}:${source.id}`, privateFields);
    } catch { result = { ...result, __decryptionError: true }; }
  }
  if (typeof source.annualCostEncryptedPayload === 'string' && state.dataKey) {
    try {
      const fields = openJson<JsonRecord>(source.annualCostEncryptedPayload, state.dataKey, 'homeapp:annual_costs:annual-cost');
      if (typeof fields.name === 'string') result.annualCostName = fields.name;
    } catch { result.__decryptionError = true; }
  }
  for (const [key, child] of Object.entries(result)) if (key !== 'encryptedPayload') result[key] = visit(child);
  return recalculateFinance(result);
}

function recalculateFinance(record: JsonRecord) {
  if (record.encryptionEntity === 'finance-savings-account' && record.amount !== undefined) {
    record.currentAmount = Number(record.amount).toFixed(2);
  }
  if (Array.isArray(record.expenses)) {
    const spent = record.expenses.reduce((sum: number, expense: JsonRecord) => sum + Number(expense.amount ?? 0), 0);
    record.spentAmount = spent.toFixed(2);
    record.remainingAmount = record.budgetAmount == null ? null : (Number(record.budgetAmount) - spent).toFixed(2);
  }
  if (Array.isArray(record.payments) && record.amount !== undefined) {
    const paid = record.payments.reduce((sum: number, payment: JsonRecord) => sum + Number(payment.amount ?? 0), 0);
    record.paidAmount = paid.toFixed(2);
    record.remainingAmount = Math.max(0, Number(record.amount) - paid).toFixed(2);
  }
  if (Array.isArray(record.transactions) && record.currentAmount !== undefined && record.transactions.length) {
    const current = record.transactions.reduce((sum: number, transaction: JsonRecord) => sum + (transaction.direction === 'add' ? 1 : -1) * Number(transaction.amount ?? 0), 0);
    record.currentAmount = Math.max(0, current).toFixed(2);
  }
  if (Array.isArray(record.categories) && Array.isArray(record.incomes) && Array.isArray(record.personSummary)) {
    const items = record.categories.flatMap((category: JsonRecord) =>
      Array.isArray(category.items) ? category.items as JsonRecord[] : []
    );
    const incomes = record.incomes as JsonRecord[];
    const personSummary = (record.personSummary as JsonRecord[]).map((person) => {
      const ownerId = person.ownerMemberId;
      const owned = items.filter((item) => (item.owner as JsonRecord | undefined)?.memberId === ownerId);
      const income = incomes.find((item) => item.ownerMemberId === ownerId);
      const budget = owned.reduce((sum, item) => sum + Number(item.budgetAmount ?? 0), 0);
      const spent = owned.reduce((sum, item) => sum + Number(item.spentAmount ?? 0), 0);
      return {
        ...person,
        incomeAmount: Number(income?.amount ?? 0).toFixed(2),
        totalBudgetAmount: budget.toFixed(2),
        totalSpentAmount: spent.toFixed(2),
        totalRemainingAmount: (budget - spent).toFixed(2),
      };
    });
    record.personSummary = personSummary;
    record.summary = personSummary.reduce(
      (total, person) => ({
        incomeAmount: (Number(total.incomeAmount) + Number(person.incomeAmount)).toFixed(2),
        totalBudgetAmount: (Number(total.totalBudgetAmount) + Number(person.totalBudgetAmount)).toFixed(2),
        totalSpentAmount: (Number(total.totalSpentAmount) + Number(person.totalSpentAmount)).toFixed(2),
        totalRemainingAmount: (Number(total.totalRemainingAmount) + Number(person.totalRemainingAmount)).toFixed(2),
      }),
      { incomeAmount: '0.00', totalBudgetAmount: '0.00', totalSpentAmount: '0.00', totalRemainingAmount: '0.00' }
    );
  }
  return record;
}

import type { EncryptableModuleKey } from '@homeapp/shared-types';
import { openJson, sealJson } from './crypto';

type JsonRecord = Record<string, unknown>;

interface RuntimeState {
  dataKey: Uint8Array | null;
  enabledModules: Set<EncryptableModuleKey>;
  keyVersion: number | null;
}

const state: RuntimeState = {
  dataKey: null,
  enabledModules: new Set(),
  keyVersion: null
};

const decryptedRecordCache = new Map<string, JsonRecord>();

const entityModules: Record<string, EncryptableModuleKey> = {
  attachment: 'attachments',
  'annual-cost': 'annual_costs',
  'annual-cost-history': 'annual_costs',
  'cleaning-task': 'cleaning',
  'data-entry': 'data_entries',
  'meal-idea': 'meal_planner',
  'meal-plan-entry': 'meal_planner',
  'note-item': 'notes',
  'shopping-item': 'shopping',
  'todo-item': 'todo'
};

export function configureRuntimeEncryption(input: {
  dataKey: Uint8Array | null;
  enabledModules: EncryptableModuleKey[];
  keyVersion: number | null;
}) {
  const keyChanged = state.dataKey !== input.dataKey || state.keyVersion !== input.keyVersion;

  state.dataKey = input.dataKey;
  state.enabledModules = new Set(input.enabledModules);
  state.keyVersion = input.keyVersion;

  if (keyChanged) {
    decryptedRecordCache.clear();
  }
}

export function isRuntimeModuleEncrypted(module: EncryptableModuleKey): boolean {
  return state.enabledModules.has(module);
}

export async function prepareEncryptedApiBody<T>(
  path: string,
  method: string,
  body: T
): Promise<T> {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const record = body as JsonRecord;

  if (
    method === 'POST' &&
    path === '/attachments/upload-url' &&
    state.enabledModules.has('attachments')
  ) {
    const mimeType = typeof record.mimeType === 'string' ? record.mimeType : '';
    const extensions: Record<string, string> = {
      'application/pdf': '.pdf',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp'
    };

    return { ...record, fileName: `plik${extensions[mimeType] ?? ''}` } as T;
  }

  if (method === 'PATCH' && /^\/meal-plans\/[^/]+$/.test(path)) {
    if (!state.enabledModules.has('meal_planner') || !Array.isArray(record.entries)) {
      return body;
    }

    return {
      ...record,
      entries: await Promise.all(
        record.entries.map((entry) =>
          encryptRecord(
            'meal_planner',
            'meal-plan-entry',
            entry as JsonRecord,
            ['mealName', 'linkUrl', 'note'],
            { linkUrl: null, mealName: '[Zaszyfrowany posiłek]', note: null }
          )
        )
      )
    } as T;
  }

  if (method === 'POST' && path === '/meal-ideas') {
    return maybeEncrypt(
      body,
      'meal_planner',
      'meal-idea',
      ['title', 'linkUrl', 'note'],
      { linkUrl: null, note: null, title: '[Zaszyfrowany pomysł]' }
    );
  }

  const mealIdeaId = path.match(/^\/meal-ideas\/([^/]+)$/)?.[1];
  if (method === 'PATCH' && mealIdeaId) {
    return maybeEncrypt(
      body,
      'meal_planner',
      'meal-idea',
      ['title', 'linkUrl', 'note'],
      { linkUrl: null, note: null, title: '[Zaszyfrowany pomysł]' },
      mealIdeaId
    );
  }

  if (method === 'POST' && path === '/todo-items') {
    return maybeEncrypt(body, 'todo', 'todo-item', ['title', 'description'], {
      description: '',
      title: '[Zaszyfrowane zadanie]'
    });
  }

  const todoId = path.match(/^\/todo-items\/([^/]+)$/)?.[1];
  if (method === 'PATCH' && todoId) {
    return maybeEncrypt(body, 'todo', 'todo-item', ['title', 'description'], {
      description: '',
      title: '[Zaszyfrowane zadanie]'
    }, todoId);
  }

  if (method === 'POST' && path === '/notes') {
    return maybeEncrypt(body, 'notes', 'note-item', ['title', 'description'], {
      description: '',
      title: '[Zaszyfrowana notatka]'
    });
  }

  const noteId = path.match(/^\/notes\/([^/]+)$/)?.[1];
  if (method === 'PATCH' && noteId) {
    return maybeEncrypt(body, 'notes', 'note-item', ['title', 'description'], {
      description: '',
      title: '[Zaszyfrowana notatka]'
    }, noteId);
  }

  if (method === 'POST' && path === '/cleaning') {
    return maybeEncrypt(body, 'cleaning', 'cleaning-task', ['name', 'location'], {
      location: null,
      name: '[Zaszyfrowane sprzątanie]'
    });
  }

  const cleaningId = path.match(/^\/cleaning\/([^/]+)$/)?.[1];
  if (method === 'PATCH' && cleaningId) {
    return maybeEncrypt(body, 'cleaning', 'cleaning-task', ['name', 'location'], {
      location: null,
      name: '[Zaszyfrowane sprzątanie]'
    }, cleaningId);
  }

  if (method === 'POST' && path === '/annual-costs') {
    return maybeEncrypt(body, 'annual_costs', 'annual-cost', ['name', 'defaultAmount'], {
      defaultAmount: null,
      name: '[Zaszyfrowany koszt]'
    });
  }

  const annualCostId = path.match(/^\/annual-costs\/([^/]+)$/)?.[1];
  if (method === 'PATCH' && annualCostId) {
    return maybeEncrypt(
      body,
      'annual_costs',
      'annual-cost',
      ['name', 'defaultAmount'],
      { defaultAmount: null, name: '[Zaszyfrowany koszt]' },
      annualCostId
    );
  }

  if (method === 'POST' && /^\/annual-costs\/[^/]+\/complete$/.test(path)) {
    return maybeEncrypt(body, 'annual_costs', 'annual-cost-history', ['amount'], {
      amount: null
    });
  }

  if (method === 'POST' && path === '/data-entries') {
    return maybeEncrypt(body, 'data_entries', 'data-entry', ['title', 'value'], {
      title: '[Zaszyfrowany wpis]',
      value: '[Zaszyfrowane]'
    });
  }

  const dataEntryId = path.match(/^\/data-entries\/([^/]+)$/)?.[1];
  if (method === 'PATCH' && dataEntryId) {
    return maybeEncrypt(
      body,
      'data_entries',
      'data-entry',
      ['title', 'value'],
      { title: '[Zaszyfrowany wpis]', value: '[Zaszyfrowane]' },
      dataEntryId
    );
  }

  if (method === 'POST' && path === '/attachments') {
    return maybeEncrypt(body, 'attachments', 'attachment', ['fileName', 'caption'], {
      caption: '',
      fileName: 'zaszyfrowany-plik'
    });
  }

  const attachmentId = path.match(/^\/attachments\/([^/]+)$/)?.[1];
  if (method === 'PATCH' && attachmentId) {
    return maybeEncrypt(body, 'attachments', 'attachment', ['fileName', 'caption'], {
      caption: '',
      fileName: 'zaszyfrowany-plik'
    }, attachmentId);
  }

  if (method === 'POST' && /^\/shopping-lists\/[^/]+\/items$/.test(path)) {
    return maybeEncrypt(
      body,
      'shopping',
      'shopping-item',
      ['name', 'quantity', 'category', 'expirationDate'],
      {
        category: null,
        expirationDate: null,
        name: '[Zaszyfrowany produkt]',
        quantity: ''
      }
    );
  }

  const shoppingId = path.match(/^\/shopping-lists\/items\/([^/]+)$/)?.[1];
  if (method === 'PATCH' && shoppingId) {
    return maybeEncrypt(
      body,
      'shopping',
      'shopping-item',
      ['name', 'quantity', 'category', 'expirationDate'],
      {
        category: null,
        expirationDate: null,
        name: '[Zaszyfrowany produkt]',
        quantity: ''
      },
      shoppingId
    );
  }

  return body;
}

export function transformEncryptedApiResponse<T>(value: T): T {
  return visit(value) as T;
}

async function maybeEncrypt<T>(
  body: T,
  module: EncryptableModuleKey,
  entity: string,
  privateKeys: string[],
  placeholders: JsonRecord,
  id?: string
): Promise<T> {
  if (!state.enabledModules.has(module)) {
    return body;
  }

  return encryptRecord(module, entity, body as JsonRecord, privateKeys, placeholders, id) as T;
}

async function encryptRecord(
  module: EncryptableModuleKey,
  entity: string,
  body: JsonRecord,
  privateKeys: string[],
  placeholders: JsonRecord,
  id?: string
): Promise<JsonRecord> {
  const key = requireKey();
  const current = id ? decryptedRecordCache.get(cacheKey(entity, id)) : undefined;
  const privatePayload: JsonRecord = {};

  for (const field of privateKeys) {
    if (body[field] !== undefined) {
      privatePayload[field] = body[field];
    } else if (current && current[field] !== undefined) {
      privatePayload[field] = current[field];
    } else {
      privatePayload[field] = null;
    }
  }

  return {
    ...body,
    ...placeholders,
    encryptedPayload: await sealJson(privatePayload, key, `homeapp:${module}:${entity}`),
    encryptionVersion: requireKeyVersion()
  };
}

function visit(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(visit);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const source = value as JsonRecord;
  let result: JsonRecord = { ...source };
  const entity = typeof source.encryptionEntity === 'string' ? source.encryptionEntity : null;
  const payload = typeof source.encryptedPayload === 'string' ? source.encryptedPayload : null;

  if (entity && payload && entityModules[entity] && state.dataKey) {
    const module = entityModules[entity];

    try {
      const privateFields = openJson<JsonRecord>(
        payload,
        state.dataKey,
        `homeapp:${module}:${entity}`
      );
      result = { ...result, ...privateFields };

      if (typeof source.id === 'string') {
        decryptedRecordCache.set(cacheKey(entity, source.id), privateFields);
      }
    } catch (error) {
      throw new EncryptedPayloadIntegrityError(entity, source.id, error);
    }
  }

  if (typeof source.annualCostEncryptedPayload === 'string' && state.dataKey) {
    try {
      const costFields = openJson<JsonRecord>(
        source.annualCostEncryptedPayload,
        state.dataKey,
        'homeapp:annual_costs:annual-cost'
      );
      if (typeof costFields.name === 'string') {
        result.annualCostName = costFields.name;
      }
    } catch (error) {
      throw new EncryptedPayloadIntegrityError('annual-cost', source.id, error);
    }
  }

  for (const [key, child] of Object.entries(result)) {
    if (key !== 'encryptedPayload') {
      result[key] = visit(child);
    }
  }

  return result;
}

export class EncryptedPayloadIntegrityError extends Error {
  readonly entity: string;
  readonly recordId: string | null;

  constructor(entity: string, recordId: unknown, cause?: unknown) {
    super(
      `Nie udało się zweryfikować integralności zaszyfrowanych danych (${entity}). ` +
        'Dane mogły zostać uszkodzone albo zmienione.'
    );
    this.name = 'EncryptedPayloadIntegrityError';
    this.entity = entity;
    this.recordId = typeof recordId === 'string' ? recordId : null;
    this.cause = cause;
  }
}

function requireKey(): Uint8Array {
  if (!state.dataKey) {
    throw new Error('Odblokuj szyfrowanie, aby zapisać dane w tym module.');
  }

  return state.dataKey;
}

function requireKeyVersion(): number {
  if (!state.keyVersion) {
    throw new Error('Brak wersji klucza szyfrowania dla tego domu.');
  }

  return state.keyVersion;
}

function cacheKey(entity: string, id: string): string {
  return `${entity}:${id}`;
}

import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import type { EncryptableModuleKey } from '@homeapp/shared-types';
import type { Observable } from 'rxjs';
import { finalize } from 'rxjs';
import type { AuthenticatedRequest } from '../../shared/request-context';
import { EncryptionService } from './encryption.service';

type JsonRecord = Record<string, unknown>;

@Injectable()
export class EncryptionWriteInterceptor implements NestInterceptor {
  constructor(private readonly encryption: EncryptionService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const householdId = request.householdContext?.householdId;
    const body = request.body as JsonRecord | undefined;

    if (!householdId || !body || !['PATCH', 'POST', 'PUT'].includes(request.method)) {
      return next.handle();
    }

    const path = this.normalizePath(request.path);
    const releaseLock = this.isEncryptableMutationPath(path)
      ? await this.encryption.acquireHouseholdWriteLock(householdId)
      : null;

    try {
      const response = await this.interceptProtectedWrite(
        householdId,
        path,
        request.method,
        body,
        next
      );

      return releaseLock
        ? response.pipe(finalize(() => void releaseLock()))
        : response;
    } catch (error) {
      await releaseLock?.();
      throw error;
    }
  }

  private async interceptProtectedWrite(
    householdId: string,
    path: string,
    method: string,
    body: JsonRecord,
    next: CallHandler
  ): Promise<Observable<unknown>> {

    if (method === 'POST' && /^\/shopping-lists\/[^/]+\/items\/ai-import$/.test(path)) {
      const encryptionState = await this.encryption.getModuleEncryptionState(
        householdId,
        'shopping'
      );

      if (encryptionState.enabled) {
        body.planOnly = true;
      }

      return next.handle();
    }

    const rule = this.ruleFor(path, method);

    if (!rule) {
      return next.handle();
    }

    const encryptionState = await this.encryption.getModuleEncryptionState(
      householdId,
      rule.module
    );

    if (rule.entries) {
      if (!Array.isArray(body.entries)) {
        return next.handle();
      }

      for (const entry of body.entries) {
        this.enforceEnvelope(
          entry as JsonRecord,
          encryptionState.enabled,
          encryptionState.keyVersion,
          rule.fields,
          rule.placeholders,
          rule.module
        );
      }
    } else {
      this.enforceEnvelope(
        body,
        encryptionState.enabled,
        encryptionState.keyVersion,
        rule.fields,
        rule.placeholders,
        rule.module
      );
    }

    return next.handle();
  }

  private isEncryptableMutationPath(path: string): boolean {
    return [
      '/annual-costs',
      '/attachments',
      '/calendar',
      '/cleaning',
      '/data-entries',
      '/finance',
      '/meal-ideas',
      '/meal-plans',
      '/notes',
      '/shopping-lists',
      '/todo-items'
    ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  }

  private enforceEnvelope(
    body: JsonRecord,
    enabled: boolean,
    expectedKeyVersion: number | null,
    fields: string[],
    placeholders: JsonRecord,
    module: EncryptableModuleKey
  ): void {
    const hasEnvelope =
      typeof body.encryptedPayload === 'string' &&
      body.encryptedPayload.length > 0 &&
      Number.isInteger(body.encryptionVersion) &&
      Number(body.encryptionVersion) > 0;

    if (enabled && !hasEnvelope) {
      throw new BadRequestException(
        `Moduł ${module} jest zaszyfrowany. Zapis wymaga odblokowanego klucza na urządzeniu.`
      );
    }

    if (enabled && body.encryptionVersion !== expectedKeyVersion) {
      throw new BadRequestException(
        `Klucz szyfrowania dla modułu ${module} jest nieaktualny. Odblokuj dane ponownie.`
      );
    }

    if (!enabled && hasEnvelope) {
      throw new BadRequestException(
        `Moduł ${module} nie ma włączonego szyfrowania dla tego domu.`
      );
    }

    if (enabled) {
      for (const field of fields) {
        body[field] = placeholders[field] ?? null;
      }
    }
  }

  private normalizePath(path: string): string {
    const normalized = path.split('?')[0] ?? path;
    return normalized.startsWith('/api/') ? normalized.slice(4) : normalized;
  }

  private ruleFor(path: string, method: string): EncryptionWriteRule | null {
    if (method === 'PATCH' && /^\/meal-plans\/[^/]+$/.test(path)) {
      return rule('meal_planner', ['mealName', 'linkUrl', 'note'], {
        linkUrl: null,
        mealName: '[Zaszyfrowany posiłek]',
        note: null
      }, true);
    }
    if (method === 'POST' && path === '/meal-ideas') {
      return rule('meal_planner', ['title', 'linkUrl', 'note'], {
        linkUrl: null,
        note: null,
        title: '[Zaszyfrowany pomysł]'
      });
    }
    if (method === 'PATCH' && /^\/meal-ideas\/[^/]+$/.test(path)) {
      return rule('meal_planner', ['title', 'linkUrl', 'note'], {
        linkUrl: null,
        note: null,
        title: '[Zaszyfrowany pomysł]'
      });
    }
    if (method === 'POST' && path === '/todo-items') {
      return rule('todo', ['title', 'description'], {
        description: '',
        title: '[Zaszyfrowane zadanie]'
      });
    }
    if (method === 'PATCH' && /^\/todo-items\/[^/]+$/.test(path)) {
      return rule('todo', ['title', 'description'], {
        description: '',
        title: '[Zaszyfrowane zadanie]'
      });
    }
    if (method === 'POST' && path === '/notes') {
      return rule('notes', ['title', 'description'], {
        description: '',
        title: '[Zaszyfrowana notatka]'
      });
    }
    if (method === 'PATCH' && /^\/notes\/[^/]+$/.test(path)) {
      return rule('notes', ['title', 'description'], {
        description: '',
        title: '[Zaszyfrowana notatka]'
      });
    }
    if (method === 'POST' && path === '/cleaning') {
      return rule('cleaning', ['name', 'location'], {
        location: null,
        name: '[Zaszyfrowane sprzątanie]'
      });
    }
    if (method === 'PATCH' && /^\/cleaning\/[^/]+$/.test(path)) {
      return rule('cleaning', ['name', 'location'], {
        location: null,
        name: '[Zaszyfrowane sprzątanie]'
      });
    }
    if (method === 'POST' && path === '/annual-costs') {
      return rule('annual_costs', ['name', 'defaultAmount'], {
        defaultAmount: null,
        name: '[Zaszyfrowany koszt]'
      });
    }
    if (method === 'PATCH' && /^\/annual-costs\/[^/]+$/.test(path)) {
      return rule('annual_costs', ['name', 'defaultAmount'], {
        defaultAmount: null,
        name: '[Zaszyfrowany koszt]'
      });
    }
    if (method === 'POST' && /^\/annual-costs\/[^/]+\/complete$/.test(path)) {
      return rule('annual_costs', ['amount'], { amount: null });
    }
    if (method === 'POST' && path === '/data-entries') {
      return rule('data_entries', ['title', 'value'], {
        title: '[Zaszyfrowany wpis]',
        value: '[Zaszyfrowane]'
      });
    }
    if (method === 'PATCH' && /^\/data-entries\/[^/]+$/.test(path)) {
      return rule('data_entries', ['title', 'value'], {
        title: '[Zaszyfrowany wpis]',
        value: '[Zaszyfrowane]'
      });
    }
    if (method === 'POST' && path === '/attachments') {
      return rule('attachments', ['fileName', 'caption'], {
        caption: '',
        fileName: 'zaszyfrowany-plik'
      });
    }
    if (method === 'PATCH' && /^\/attachments\/[^/]+$/.test(path)) {
      return rule('attachments', ['fileName', 'caption'], {
        caption: '',
        fileName: 'zaszyfrowany-plik'
      });
    }
    if (method === 'POST' && /^\/shopping-lists\/[^/]+\/items$/.test(path)) {
      return rule('shopping', ['name', 'quantity', 'category', 'expirationDate'], {
        category: null,
        expirationDate: null,
        name: '[Zaszyfrowany produkt]',
        quantity: ''
      });
    }
    if (method === 'PATCH' && /^\/shopping-lists\/items\/[^/]+$/.test(path)) {
      return rule('shopping', ['name', 'quantity', 'category', 'expirationDate'], {
        category: null,
        expirationDate: null,
        name: '[Zaszyfrowany produkt]',
        quantity: ''
      });
    }

    return null;
  }
}

interface EncryptionWriteRule {
  entries: boolean;
  fields: string[];
  module: EncryptableModuleKey;
  placeholders: JsonRecord;
}

function rule(
  module: EncryptableModuleKey,
  fields: string[],
  placeholders: JsonRecord,
  entries = false
): EncryptionWriteRule {
  return { entries, fields, module, placeholders };
}

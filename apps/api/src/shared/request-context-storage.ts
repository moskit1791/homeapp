import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { HouseholdContext, UserContext } from './request-context';

export interface RequestExecutionContext {
  household?: HouseholdContext;
  user?: UserContext;
}

@Injectable()
export class RequestContextStorage {
  private readonly storage = new AsyncLocalStorage<RequestExecutionContext>();

  get(): RequestExecutionContext | undefined {
    return this.storage.getStore();
  }

  run<T>(context: RequestExecutionContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }
}

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthenticatedRequest } from './request-context';
import { RequestContextStorage } from './request-context-storage';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(private readonly requestContextStorage: RequestContextStorage) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const requestContext = {
      household: request.householdContext,
      user: request.userContext
    };

    return new Observable((subscriber) =>
      this.requestContextStorage.run(requestContext, () => {
        const subscription = next.handle().subscribe({
          complete: () => subscriber.complete(),
          error: (error: unknown) => subscriber.error(error),
          next: (value: unknown) => subscriber.next(value)
        });

        return () => subscription.unsubscribe();
      })
    );
  }
}

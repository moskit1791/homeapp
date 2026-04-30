import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { loadEnv } from '../../../shared/env';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, RateLimitBucket>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const env = loadEnv();
    const now = Date.now();
    const windowMs = env.AUTH_RATE_LIMIT_WINDOW_SECONDS * 1000;
    const key = this.getKey(request);
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + windowMs
      });
      this.pruneExpired(now);
      return true;
    }

    if (bucket.count >= env.AUTH_RATE_LIMIT_MAX) {
      throw new HttpException('Too many auth requests. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    bucket.count += 1;
    return true;
  }

  private getKey(request: Request): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    const clientIp = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(',')[0]?.trim();

    return [
      clientIp || request.ip || request.socket.remoteAddress || 'unknown',
      request.path
    ].join(':');
  }

  private pruneExpired(now: number): void {
    if (this.buckets.size < 1_000) {
      return;
    }

    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

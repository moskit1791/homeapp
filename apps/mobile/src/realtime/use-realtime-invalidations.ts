import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeEvent } from '../api';
import { invalidateRealtimeEventQueries } from './query-invalidation';
import { subscribeToRealtimeEvents } from './sse';

export interface UseRealtimeInvalidationsOptions {
  accessToken?: string | null;
  enabled?: boolean;
  onError?: (error: unknown) => void;
  onEvent?: (event: RealtimeEvent) => void;
}

export function useRealtimeInvalidations(options: UseRealtimeInvalidationsOptions): void {
  const queryClient = useQueryClient();
  const { accessToken, enabled = true, onError, onEvent } = options;

  useEffect(() => {
    if (!enabled || !accessToken) {
      return undefined;
    }

    const subscription = subscribeToRealtimeEvents({
      accessToken,
      onError,
      onEvent: (event) => {
        void invalidateRealtimeEventQueries(queryClient, event);
        onEvent?.(event);
      }
    });

    return () => subscription.unsubscribe();
  }, [accessToken, enabled, onError, onEvent, queryClient]);
}

export function useRealtimeInvalidation(accessToken?: string | null): void {
  useRealtimeInvalidations({ accessToken });
}

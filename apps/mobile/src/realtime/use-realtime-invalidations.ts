import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeEvent } from '../api';
import {
  invalidateAllRealtimeQueries,
  invalidateRealtimeEventQueries
} from './query-invalidation';
import { subscribeToRealtimeEvents } from './sse';

const fallbackRefreshIntervalMs = 5_000;

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

    if (subscription.supported) {
      return () => subscription.unsubscribe();
    }

    void invalidateAllRealtimeQueries(queryClient);
    const fallbackRefresh = setInterval(() => {
      void invalidateAllRealtimeQueries(queryClient);
    }, fallbackRefreshIntervalMs);

    return () => {
      clearInterval(fallbackRefresh);
      subscription.unsubscribe();
    };
  }, [accessToken, enabled, onError, onEvent, queryClient]);
}

export function useRealtimeInvalidation(accessToken?: string | null): void {
  useRealtimeInvalidations({ accessToken });
}

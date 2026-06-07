import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const defaultDelayMs = 2000;

interface PendingToggle {
  baseValue: boolean;
  desiredValue: boolean;
  onError?: (id: string) => void;
  onSettled?: () => Promise<unknown> | unknown;
  revert: (value: boolean) => void;
  sync: (
    id: string,
    desiredValue: boolean,
    baseValue: boolean,
  ) => Promise<unknown>;
  syncing: boolean;
  timeout: ReturnType<typeof setTimeout> | null;
}

interface UseDebouncedOptimisticToggleOptions<TItem> {
  delayMs?: number;
  getId: (item: TItem) => string;
  getValue: (item: TItem) => boolean;
  onError?: (id: string) => void;
  onSettled?: () => Promise<unknown> | unknown;
  queryClient: QueryClient;
  queryKey: QueryKey;
  setValue: (item: TItem, value: boolean) => TItem;
  sync: (
    id: string,
    desiredValue: boolean,
    baseValue: boolean,
  ) => Promise<unknown>;
}

export function useDebouncedOptimisticToggle<TItem>({
  delayMs = defaultDelayMs,
  getId,
  getValue,
  onError,
  onSettled,
  queryClient,
  queryKey,
  setValue,
  sync,
}: UseDebouncedOptimisticToggleOptions<TItem>) {
  const mountedRef = useRef(true);
  const pendingRef = useRef(new Map<string, PendingToggle>());
  const flushRef = useRef<(id: string) => Promise<void>>(async () => undefined);
  const queryKeyHash = useMemo(() => JSON.stringify(queryKey), [queryKey]);
  const [syncingIds, setSyncingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const markSyncing = useCallback((id: string, isSyncing: boolean) => {
    if (!mountedRef.current) {
      return;
    }

    setSyncingIds((current) => {
      const next = new Set(current);

      if (isSyncing) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });
  }, []);

  const updateCachedValue = useCallback(
    (id: string, value: boolean) => {
      queryClient.setQueryData<TItem[]>(queryKey, (current) => {
        if (!current) {
          return current;
        }

        let changed = false;
        const next = current.map((item) => {
          if (getId(item) !== id) {
            return item;
          }

          changed = true;
          return setValue(item, value);
        });

        return changed ? next : current;
      });
    },
    [getId, queryClient, queryKey, setValue],
  );

  const applyPendingValues = useCallback(
    (items: TItem[]): TItem[] => {
      if (pendingRef.current.size === 0) {
        return items;
      }

      let changed = false;
      const next = items.map((item) => {
        const entry = pendingRef.current.get(getId(item));

        if (!entry || getValue(item) === entry.desiredValue) {
          return item;
        }

        changed = true;
        return setValue(item, entry.desiredValue);
      });

      return changed ? next : items;
    },
    [getId, getValue, setValue],
  );

  const reapplyPendingValues = useCallback(() => {
    queryClient.setQueryData<TItem[]>(queryKey, (current) => {
      if (!current) {
        return current;
      }

      return applyPendingValues(current);
    });
  }, [applyPendingValues, queryClient, queryKey]);

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        pendingRef.current.size === 0 ||
        !event.query ||
        JSON.stringify(event.query.queryKey) !== queryKeyHash
      ) {
        return;
      }

      reapplyPendingValues();
    });

    return unsubscribe;
  }, [queryClient, queryKeyHash, reapplyPendingValues]);

  const cancel = useCallback(
    (id: string) => {
      const entry = pendingRef.current.get(id);

      if (!entry) {
        return;
      }

      if (entry.timeout) {
        clearTimeout(entry.timeout);
      }

      pendingRef.current.delete(id);
      markSyncing(id, false);
    },
    [markSyncing],
  );

  const cancelAll = useCallback(() => {
    for (const id of Array.from(pendingRef.current.keys())) {
      cancel(id);
    }
  }, [cancel]);

  const flush = useCallback(
    async (id: string) => {
      const entry = pendingRef.current.get(id);

      if (!entry || entry.syncing) {
        return;
      }

      if (entry.timeout) {
        clearTimeout(entry.timeout);
        entry.timeout = null;
      }

      if (entry.desiredValue === entry.baseValue) {
        pendingRef.current.delete(id);
        return;
      }

      entry.syncing = true;
      markSyncing(id, true);

      try {
        await entry.sync(id, entry.desiredValue, entry.baseValue);
      } catch {
        entry.revert(entry.baseValue);
        entry.onError?.(id);
      } finally {
        pendingRef.current.delete(id);
        markSyncing(id, false);

        try {
          await entry.onSettled?.();
        } catch {
          // Background refresh failures are handled by React Query on retry.
        }
      }
    },
    [markSyncing],
  );

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(
    () => () => {
      mountedRef.current = false;

      for (const [id, entry] of pendingRef.current) {
        if (entry.timeout) {
          clearTimeout(entry.timeout);
          entry.timeout = null;
        }

        void flushRef.current(id);
      }
    },
    [],
  );

  const flushAll = useCallback(async () => {
    await Promise.all(
      Array.from(pendingRef.current.keys()).map((id) => flushRef.current(id)),
    );
  }, []);

  const isSyncing = useCallback(
    (id: string) => syncingIds.has(id),
    [syncingIds],
  );

  const toggle = useCallback(
    (id: string) => {
      const currentItems = queryClient.getQueryData<TItem[]>(queryKey);
      const item = currentItems?.find((candidate) => getId(candidate) === id);

      if (!item) {
        return;
      }

      const currentEntry = pendingRef.current.get(id);

      if (currentEntry?.syncing) {
        return;
      }

      const currentValue = getValue(item);
      const baseValue = currentEntry?.baseValue ?? currentValue;
      const desiredValue = !currentValue;

      if (currentEntry?.timeout) {
        clearTimeout(currentEntry.timeout);
      }

      void queryClient.cancelQueries({ queryKey });
      updateCachedValue(id, desiredValue);

      const entry: PendingToggle = {
        baseValue,
        desiredValue,
        onError,
        onSettled,
        revert: (value) => updateCachedValue(id, value),
        sync,
        syncing: false,
        timeout: null,
      };

      entry.timeout = setTimeout(() => {
        void flushRef.current(id);
      }, delayMs);

      pendingRef.current.set(id, entry);
    },
    [
      delayMs,
      getId,
      getValue,
      onError,
      onSettled,
      queryClient,
      queryKey,
      sync,
      updateCachedValue,
    ],
  );

  return {
    cancel,
    cancelAll,
    flushAll,
    isSyncing,
    toggle,
  };
}

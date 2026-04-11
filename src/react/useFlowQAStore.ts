/**
 * React bridge hook for FlowQAStore.
 *
 * Subscribes to the store and triggers re-renders when state changes.
 * Uses useSyncExternalStore for tear-free reads.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { FlowQAStore, createFlowQAStore, type FlowQAStoreOptions } from "../lib/store";

/**
 * Creates a store instance on first call and subscribes to it.
 * Returns the store — callers read state directly from the store object.
 *
 * The store is created once and persists for the component's lifetime.
 * Options changes (enabled toggle) are forwarded via setEnabled().
 */
export function useFlowQAStore(opts: FlowQAStoreOptions): FlowQAStore {
  const storeRef = useRef<FlowQAStore | null>(null);

  // Create store once
  if (!storeRef.current) {
    storeRef.current = createFlowQAStore(opts);
  }

  const store = storeRef.current;

  // Subscribe to force re-renders. We use a simple counter snapshot
  // so that every notify() from the store triggers a re-render.
  const snapRef = useRef(0);
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return store.subscribe(() => {
        snapRef.current += 1;
        onStoreChange();
      });
    },
    [store]
  );
  const getSnapshot = useCallback(() => snapRef.current, []);

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Forward enabled changes
  useEffect(() => {
    store.setEnabled(opts.enabled !== false);
  }, [store, opts.enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      store.dispose();
    };
  }, [store]);

  return store;
}

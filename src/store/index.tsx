"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { DataStore, Topic } from "./DataStore";
import { CHANNEL_NAME, type KV } from "./local/db";
import { LocalStore } from "./local/LocalStore";

export type { DataStore } from "./DataStore";

export const isSupabaseConfigured = (): boolean =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const memoryKV = (): KV => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

/**
 * Single seam for choosing the backend. SupabaseStore does not exist yet (Task 6):
 * that task makes this return it when `isSupabaseConfigured()`. Until then the demo store is always used.
 */
export function createStore(): DataStore {
  const browser = typeof window !== "undefined";
  return new LocalStore({
    storage: browser ? window.localStorage : memoryKV(),
    session: browser ? window.sessionStorage : undefined,
    channel: browser && typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null,
    now: () => new Date(),
  });
}

const StoreContext = createContext<DataStore | null>(null);

export function StoreProvider({ children, store }: { children: ReactNode; store?: DataStore }) {
  const [value] = useState<DataStore>(() => store ?? createStore());
  return createElement(StoreContext.Provider, { value }, children);
}

export function useStore(): DataStore {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore must be used inside <StoreProvider>");
  return s;
}

/** Loads data and re-runs the loader on store events (plus every 15 s for the remote store). */
export function useLive<T>(topic: Topic, loader: (store: DataStore) => Promise<T>) {
  const store = useStore();
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: Error | null }>({ data: null, loading: true, error: null });

  const reload = useCallback(async () => {
    try {
      const data = await loaderRef.current(store);
      setState({ data, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e : new Error(String(e)) }));
    }
  }, [store]);

  useEffect(() => {
    void reload();
    const off = store.subscribe(topic, () => void reload());
    const timer = store.kind === "supabase" ? setInterval(() => void reload(), 15000) : null;
    return () => {
      off();
      if (timer) clearInterval(timer);
    };
  }, [store, topic, reload]);

  return { ...state, reload };
}

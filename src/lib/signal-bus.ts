/**
 * Signal Bus — typed pub/sub event emitter for the Strategic Nervous System.
 *
 * Plain TypeScript, zero dependencies, no React.
 * Singleton pattern — one bus per page.
 */

import type { StrategyState } from "./strategy-inference";

/* ─── Channel Payload Map ──────────────────────────────────────────────── */

export interface SignalChannels {
  "strategy-state-changed": StrategyState;
  "step-focused": string; // stepId
  "flow-selected": string | null; // flowId
  "provocation-triggered": { id: string; title: string; detail: string }; // future
  "prompt-ready": string; // composed prompt string
  "canvas-state-changed": "calm" | "active" | "critical"; // future
}

export type SignalChannel = keyof SignalChannels;

type Listener<C extends SignalChannel> = (payload: SignalChannels[C]) => void;

/* ─── Bus Class ────────────────────────────────────────────────────────── */

export class SignalBus {
  private listeners = new Map<SignalChannel, Set<Listener<any>>>();

  subscribe<C extends SignalChannel>(channel: C, listener: Listener<C>): () => void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    const set = this.listeners.get(channel)!;
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  emit<C extends SignalChannel>(channel: C, payload: SignalChannels[C]): void {
    const set = this.listeners.get(channel);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[SignalBus] Error in listener for "${channel}":`, err);
      }
    }
  }

  unsubscribe<C extends SignalChannel>(channel: C, listener: Listener<C>): void {
    const set = this.listeners.get(channel);
    if (set) set.delete(listener);
  }
}

/* ─── Singleton ────────────────────────────────────────────────────────── */

let _instance: SignalBus | null = null;

export function getSignalBus(): SignalBus {
  if (!_instance) _instance = new SignalBus();
  return _instance;
}

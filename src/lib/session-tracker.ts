/**
 * Session tracking — tracks per-step engagement and flow session state.
 *
 * A "session" is a contiguous period of reviewing a specific flow.
 * It persists across sidebar close/reopen and page navigations.
 */

export interface StepEngagement {
  /** Cumulative milliseconds spent with this step active (on-page) */
  dwellMs: number;
  /** Number of times the user navigated to this step's page */
  visitCount: number;
  /** Timestamp of first visit */
  firstSeen: number;
  /** Timestamp of most recent visit */
  lastSeen: number;
}

export interface FlowSession {
  flowId: string;
  startedAt: number;
  /** Last activity timestamp — used for session expiry */
  lastActiveAt: number;
  /** Per-step engagement within this session */
  stepEngagement: Record<string, StepEngagement>;
  /** Whether the user completed (visited every step) */
  completed: boolean;
  completedAt?: number;
}

export interface SessionState {
  /** Currently active flow session (null = no active session) */
  activeSession: FlowSession | null;
  /** Historical completed sessions (kept for trend analysis) */
  history: FlowSession[];
}

const STORAGE_KEY = "flowqa:session";
const SESSION_EXPIRY_MS = 4 * 60 * 60 * 1000; // 4 hours

export function loadSessionState(): SessionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { activeSession: null, history: [] };
    const parsed = JSON.parse(raw) as SessionState;
    // Expire stale active session
    if (parsed.activeSession) {
      const age = Date.now() - parsed.activeSession.lastActiveAt;
      if (age > SESSION_EXPIRY_MS) {
        // Move to history if it had meaningful engagement
        const totalDwell = Object.values(parsed.activeSession.stepEngagement)
          .reduce((sum, e) => sum + e.dwellMs, 0);
        if (totalDwell > 5000) {
          parsed.history.push(parsed.activeSession);
        }
        parsed.activeSession = null;
      }
    }
    // Keep only last 20 sessions in history
    if (parsed.history.length > 20) {
      parsed.history = parsed.history.slice(-20);
    }
    return parsed;
  } catch {
    return { activeSession: null, history: [] };
  }
}

export function saveSessionState(state: SessionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full — drop history
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ activeSession: state.activeSession, history: [] })
      );
    } catch {
      // give up
    }
  }
}

/** Start or resume a session for the given flow. */
export function startOrResumeSession(
  state: SessionState,
  flowId: string
): SessionState {
  const now = Date.now();
  if (state.activeSession?.flowId === flowId) {
    // Resume — just bump lastActiveAt
    return {
      ...state,
      activeSession: { ...state.activeSession, lastActiveAt: now },
    };
  }
  // Different flow — archive old session, start new one
  const history = [...state.history];
  if (state.activeSession) {
    history.push(state.activeSession);
  }
  return {
    activeSession: {
      flowId,
      startedAt: now,
      lastActiveAt: now,
      stepEngagement: {},
      completed: false,
    },
    history,
  };
}

/** Record that the user is on a step's page. Call on each tick/navigation. */
export function recordStepPresence(
  session: FlowSession,
  stepId: string,
  elapsedMs: number
): FlowSession {
  const now = Date.now();
  const prev = session.stepEngagement[stepId];
  const engagement: StepEngagement = prev
    ? {
        dwellMs: prev.dwellMs + elapsedMs,
        visitCount: prev.visitCount,
        firstSeen: prev.firstSeen,
        lastSeen: now,
      }
    : {
        dwellMs: elapsedMs,
        visitCount: 1,
        firstSeen: now,
        lastSeen: now,
      };

  // Increment visitCount only if this is a new navigation (gap > 2s from lastSeen)
  if (prev && now - prev.lastSeen > 2000) {
    engagement.visitCount = prev.visitCount + 1;
  }

  return {
    ...session,
    lastActiveAt: now,
    stepEngagement: { ...session.stepEngagement, [stepId]: engagement },
  };
}

/** Mark session as completed if all flow steps are visited. */
export function checkSessionComplete(
  session: FlowSession,
  flowStepIds: string[],
  visited: Record<string, number>
): FlowSession {
  if (session.completed) return session;
  const allDone = flowStepIds.every((sid) => !!visited[sid]);
  if (!allDone) return session;
  return { ...session, completed: true, completedAt: Date.now() };
}

/** Get a human-readable dwell summary for a step. */
export function dwellLabel(ms: number): string {
  if (ms < 1000) return "";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

/** Compute session-level stats for display. */
export function sessionStats(session: FlowSession): {
  totalDwellMs: number;
  stepsEngaged: number;
  durationMs: number;
} {
  const engagements = Object.values(session.stepEngagement);
  const totalDwellMs = engagements.reduce((sum, e) => sum + e.dwellMs, 0);
  const stepsEngaged = engagements.length;
  const durationMs = session.lastActiveAt - session.startedAt;
  return { totalDwellMs, stepsEngaged, durationMs };
}

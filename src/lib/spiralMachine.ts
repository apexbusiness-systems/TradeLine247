/**
 * Deterministic Finite State Machine for Spiral AI
 * Enforces strict state transitions to prevent race conditions
 * 
 * APEX Enterprise Architecture - Phase 1: The Brain
 */

import { createLogger } from "@/lib/logger";

const logger = createLogger("SpiralMachine");

// ============================================================================
// STATE DEFINITIONS
// ============================================================================

export type SpiralState = 
  | "IDLE"           // Waiting for input
  | "LISTENING"      // Microphone active / text input focused
  | "PROCESSING"     // Sending transcript to Edge Function
  | "DELIBERATING"   // AI is "thinking" (UX delay)
  | "RESPONDING"     // Streaming text/question back to user
  | "CINEMATIC"      // Playing 3D breakthrough sequence
  | "ERROR";         // Graceful failure state

export type ProcessingSubState = 
  | "extracting"     // Extracting entities
  | "generating"     // Generating response
  | "breakthrough"   // Preparing breakthrough
  | null;

// ============================================================================
// EVENT DEFINITIONS
// ============================================================================

export type SpiralEvent =
  | { type: "START_LISTENING" }
  | { type: "STOP_LISTENING" }
  | { type: "TEXT_INPUT" }
  | { type: "START_PROCESSING"; payload?: { forceBreakthrough?: boolean } }
  | { type: "START_DELIBERATING" }
  | { type: "START_RESPONDING" }
  | { type: "RESPONSE_COMPLETE" }
  | { type: "TRIGGER_CINEMATIC" }
  | { type: "CINEMATIC_COMPLETE" }
  | { type: "ERROR"; payload: { message: string } }
  | { type: "RESET" }
  | { type: "DISMISS_ERROR" };

// ============================================================================
// CONTEXT (Extended State Data)
// ============================================================================

export interface SpiralContext {
  state: SpiralState;
  processingSubState: ProcessingSubState;
  error: string | null;
  transitionHistory: Array<{ from: SpiralState; to: SpiralState; event: string; timestamp: number }>;
}

// ============================================================================
// TRANSITION TABLE
// ============================================================================

type TransitionMap = {
  [K in SpiralState]: {
    [E in SpiralEvent["type"]]?: SpiralState;
  };
};

/**
 * Strict transition table - only defined transitions are allowed
 * This prevents invalid state combinations and race conditions
 */
const transitions: TransitionMap = {
  IDLE: {
    START_LISTENING: "LISTENING",
    TEXT_INPUT: "LISTENING",
    START_PROCESSING: "PROCESSING", // Allow direct processing from idle (text submit)
    TRIGGER_CINEMATIC: "CINEMATIC",
    RESET: "IDLE",
  },
  LISTENING: {
    STOP_LISTENING: "IDLE",
    START_PROCESSING: "PROCESSING",
    ERROR: "ERROR",
    RESET: "IDLE",
  },
  PROCESSING: {
    START_DELIBERATING: "DELIBERATING",
    START_RESPONDING: "RESPONDING",
    TRIGGER_CINEMATIC: "CINEMATIC",
    ERROR: "ERROR",
    RESET: "IDLE",
  },
  DELIBERATING: {
    START_RESPONDING: "RESPONDING",
    TRIGGER_CINEMATIC: "CINEMATIC",
    ERROR: "ERROR",
    RESET: "IDLE",
  },
  RESPONDING: {
    RESPONSE_COMPLETE: "IDLE",
    TRIGGER_CINEMATIC: "CINEMATIC",
    START_LISTENING: "LISTENING", // Allow immediate follow-up
    ERROR: "ERROR",
    RESET: "IDLE",
  },
  CINEMATIC: {
    CINEMATIC_COMPLETE: "IDLE",
    ERROR: "ERROR",
    RESET: "IDLE",
  },
  ERROR: {
    DISMISS_ERROR: "IDLE",
    RESET: "IDLE",
    START_LISTENING: "LISTENING", // Allow recovery
  },
};

// ============================================================================
// REDUCER
// ============================================================================

export function spiralReducer(
  context: SpiralContext,
  event: SpiralEvent
): SpiralContext {
  const currentState = context.state;
  const eventType = event.type;
  
  // Get next state from transition table
  const nextState = transitions[currentState]?.[eventType];
  
  // Invalid transition - log and return unchanged
  if (!nextState) {
    logger.warn("Invalid state transition blocked", {
      currentState,
      event: eventType,
      allowedTransitions: Object.keys(transitions[currentState] || {}),
    });
    return context;
  }
  
  // Track transition history (keep last 20)
  const historyEntry = {
    from: currentState,
    to: nextState,
    event: eventType,
    timestamp: Date.now(),
  };
  
  const newHistory = [...context.transitionHistory, historyEntry].slice(-20);
  
  logger.info("State transition", {
    from: currentState,
    to: nextState,
    event: eventType,
  });
  
  // Handle sub-state and error updates
  let processingSubState = context.processingSubState;
  let error = context.error;
  
  // Set processing sub-state based on event
  if (eventType === "START_PROCESSING") {
    const payload = (event as { type: "START_PROCESSING"; payload?: { forceBreakthrough?: boolean } }).payload;
    processingSubState = payload?.forceBreakthrough ? "breakthrough" : "extracting";
  } else if (eventType === "START_DELIBERATING") {
    processingSubState = "generating";
  } else if (nextState === "IDLE" || nextState === "LISTENING" || nextState === "CINEMATIC") {
    processingSubState = null;
  }
  
  // Handle error state
  if (eventType === "ERROR") {
    error = (event as { type: "ERROR"; payload: { message: string } }).payload.message;
  } else if (eventType === "DISMISS_ERROR" || eventType === "RESET") {
    error = null;
  }
  
  return {
    state: nextState,
    processingSubState,
    error,
    transitionHistory: newHistory,
  };
}

// ============================================================================
// INITIAL CONTEXT
// ============================================================================

export function createInitialContext(): SpiralContext {
  return {
    state: "IDLE",
    processingSubState: null,
    error: null,
    transitionHistory: [],
  };
}

// ============================================================================
// STATE PREDICATES (for backward compatibility)
// ============================================================================

export function isProcessing(context: SpiralContext): boolean {
  return ["PROCESSING", "DELIBERATING", "RESPONDING"].includes(context.state);
}

export function isListening(context: SpiralContext): boolean {
  return context.state === "LISTENING";
}

export function isCinematic(context: SpiralContext): boolean {
  return context.state === "CINEMATIC";
}

export function isError(context: SpiralContext): boolean {
  return context.state === "ERROR";
}

export function canStartProcessing(context: SpiralContext): boolean {
  return ["IDLE", "LISTENING"].includes(context.state);
}

export function canTriggerCinematic(context: SpiralContext): boolean {
  return ["IDLE", "PROCESSING", "DELIBERATING", "RESPONDING"].includes(context.state);
}

// ============================================================================
// DEBUG HELPERS
// ============================================================================

export function getStateDebugInfo(context: SpiralContext): string {
  return JSON.stringify({
    state: context.state,
    subState: context.processingSubState,
    error: context.error,
    lastTransitions: context.transitionHistory.slice(-5).map(t => `${t.from} -> ${t.to} (${t.event})`),
  }, null, 2);
}

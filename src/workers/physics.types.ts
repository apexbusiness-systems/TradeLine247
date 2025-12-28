/**
 * Physics Worker Message Types
 * 
 * APEX Architecture Phase 2: The Muscle
 * Strict type interface for Worker communication
 */

import type { Entity, Connection } from "@/lib/types";

// ============================================================================
// INPUT MESSAGES (Main Thread -> Worker)
// ============================================================================

export interface UpdateNodesMessage {
  type: "UPDATE_NODES";
  entities: SerializableEntity[];
  connections: SerializableConnection[];
  config?: PhysicsConfig;
}

export interface ResetMessage {
  type: "RESET";
}

export interface PauseMessage {
  type: "PAUSE";
}

export interface ResumeMessage {
  type: "RESUME";
}

export type WorkerInputMessage = 
  | UpdateNodesMessage 
  | ResetMessage 
  | PauseMessage 
  | ResumeMessage;

// ============================================================================
// OUTPUT MESSAGES (Worker -> Main Thread)
// ============================================================================

export interface PositionsUpdatedMessage {
  type: "POSITIONS_UPDATED";
  /** Flat array: [x1, y1, z1, x2, y2, z2, ...] */
  positions: Float32Array;
  /** Entity IDs in same order as positions */
  entityIds: string[];
  /** Iteration count for debugging */
  iteration: number;
  /** Whether simulation has stabilized */
  stabilized: boolean;
}

export interface WorkerReadyMessage {
  type: "WORKER_READY";
}

export interface WorkerErrorMessage {
  type: "WORKER_ERROR";
  error: string;
}

export type WorkerOutputMessage = 
  | PositionsUpdatedMessage 
  | WorkerReadyMessage 
  | WorkerErrorMessage;

// ============================================================================
// SERIALIZABLE TYPES (For Worker Transfer)
// ============================================================================

export interface SerializableEntity {
  id: string;
  type: string;
  label: string;
  importance?: number;
  positionHint?: string;
}

export interface SerializableConnection {
  fromEntityId: string;
  toEntityId: string;
  type: string;
  strength: number;
}

// ============================================================================
// PHYSICS CONFIGURATION
// ============================================================================

export interface PhysicsConfig {
  /** Number of iterations per frame (default: 50) */
  iterations?: number;
  /** Repulsion force strength (default: 0.8) */
  repulsionStrength?: number;
  /** Attraction force strength (default: 0.05) */
  attractionStrength?: number;
  /** Velocity damping (default: 0.9) */
  damping?: number;
  /** Minimum distance before repulsion (default: 1.5) */
  minDistance?: number;
  /** Ideal distance for connected nodes (default: 2) */
  idealDistance?: number;
  /** Target spread for normalization (default: 4) */
  targetRange?: number;
  /** Stabilization threshold (default: 0.001) */
  stabilizationThreshold?: number;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert Entity to SerializableEntity
 */
export function toSerializableEntity(entity: Entity): SerializableEntity {
  return {
    id: entity.id,
    type: entity.type,
    label: entity.label,
    importance: entity.metadata?.importance,
    positionHint: entity.metadata?.positionHint,
  };
}

/**
 * Convert Connection to SerializableConnection
 */
export function toSerializableConnection(connection: Connection): SerializableConnection {
  return {
    fromEntityId: connection.fromEntityId,
    toEntityId: connection.toEntityId,
    type: connection.type,
    strength: connection.strength,
  };
}

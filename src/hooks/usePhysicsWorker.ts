/**
 * Physics Worker Hook
 * 
 * APEX Architecture Phase 2: The Muscle
 * React hook for managing Web Worker physics calculations
 * Applies position updates directly to Three.js refs for 60FPS performance
 */

import { useEffect, useRef, useCallback, useState } from "react";
import type { Entity, Connection } from "@/lib/types";
import type { 
  WorkerInputMessage, 
  WorkerOutputMessage,
  PhysicsConfig,
} from "@/workers/physics.types";
import { toSerializableEntity, toSerializableConnection } from "@/workers/physics.types";
import { createLogger } from "@/lib/logger";

const logger = createLogger("usePhysicsWorker");

export interface PhysicsWorkerState {
  isReady: boolean;
  isCalculating: boolean;
  lastError: string | null;
  iteration: number;
  stabilized: boolean;
}

export interface UsePhysicsWorkerOptions {
  /** Callback when positions are updated */
  onPositionsUpdate?: (positions: Map<string, [number, number, number]>) => void;
  /** Custom physics config */
  config?: PhysicsConfig;
  /** Whether to auto-update when entities/connections change */
  autoUpdate?: boolean;
}

export interface UsePhysicsWorkerReturn {
  /** Current worker state */
  state: PhysicsWorkerState;
  /** Manually trigger a position update */
  updateNodes: (entities: Entity[], connections: Connection[]) => void;
  /** Reset the worker */
  reset: () => void;
  /** Pause simulation */
  pause: () => void;
  /** Resume simulation */
  resume: () => void;
  /** Get positions map */
  getPositions: () => Map<string, [number, number, number]>;
}

/**
 * Hook for managing off-main-thread physics calculations
 */
export function usePhysicsWorker(
  entities: Entity[],
  connections: Connection[],
  options: UsePhysicsWorkerOptions = {}
): UsePhysicsWorkerReturn {
  const { onPositionsUpdate, config, autoUpdate = true } = options;
  
  // Worker ref
  const workerRef = useRef<Worker | null>(null);
  
  // Positions cache (updated by worker)
  const positionsRef = useRef<Map<string, [number, number, number]>>(new Map());
  
  // State
  const [state, setState] = useState<PhysicsWorkerState>({
    isReady: false,
    isCalculating: false,
    lastError: null,
    iteration: 0,
    stabilized: true,
  });
  
  // Callbacks ref to avoid stale closures
  const callbacksRef = useRef({ onPositionsUpdate });
  callbacksRef.current = { onPositionsUpdate };
  
  // Initialize worker
  useEffect(() => {
    // Create worker
    try {
      workerRef.current = new Worker(
        new URL("../workers/physics.worker.ts", import.meta.url),
        { type: "module" }
      );
      
      // Handle messages from worker
      workerRef.current.onmessage = (event: MessageEvent<WorkerOutputMessage>) => {
        const { type } = event.data;
        
        switch (type) {
          case "WORKER_READY": {
            logger.info("Physics worker ready");
            setState(prev => ({ ...prev, isReady: true }));
            break;
          }
          
          case "POSITIONS_UPDATED": {
            const { positions, entityIds, iteration, stabilized } = event.data;
            
            // Update positions map
            const newPositions = new Map<string, [number, number, number]>();
            entityIds.forEach((id, index) => {
              newPositions.set(id, [
                positions[index * 3],
                positions[index * 3 + 1],
                positions[index * 3 + 2],
              ]);
            });
            
            positionsRef.current = newPositions;
            
            setState(prev => ({
              ...prev,
              isCalculating: false,
              iteration,
              stabilized,
            }));
            
            // Call callback
            callbacksRef.current.onPositionsUpdate?.(newPositions);
            
            logger.debug("Positions updated", {
              entityCount: entityIds.length,
              iteration,
              stabilized,
            });
            break;
          }
          
          case "WORKER_ERROR": {
            const errorMsg = (event.data as { type: "WORKER_ERROR"; error: string }).error;
            logger.error("Physics worker error", new Error(errorMsg));
            setState(prev => ({
              ...prev,
              isCalculating: false,
              lastError: errorMsg,
            }));
            break;
          }
        }
      };
      
      workerRef.current.onerror = (error: ErrorEvent) => {
        logger.error("Physics worker fatal error", new Error(error.message));
        setState(prev => ({
          ...prev,
          isReady: false,
          isCalculating: false,
          lastError: error.message,
        }));
      };
      
    } catch (error) {
      logger.error("Failed to create physics worker", error);
      setState(prev => ({
        ...prev,
        lastError: error instanceof Error ? error.message : "Failed to create worker",
      }));
    }
    
    // Cleanup
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);
  
  // Update nodes function
  const updateNodes = useCallback((entities: Entity[], connections: Connection[]) => {
    if (!workerRef.current || !state.isReady) {
      logger.warn("Worker not ready, skipping update");
      return;
    }
    
    setState(prev => ({ ...prev, isCalculating: true, lastError: null }));
    
    const message: WorkerInputMessage = {
      type: "UPDATE_NODES",
      entities: entities.map(toSerializableEntity),
      connections: connections.map(toSerializableConnection),
      config,
    };
    
    workerRef.current.postMessage(message);
    
    logger.debug("Sent UPDATE_NODES to worker", {
      entityCount: entities.length,
      connectionCount: connections.length,
    });
  }, [state.isReady, config]);
  
  // Auto-update when entities/connections change
  useEffect(() => {
    if (autoUpdate && state.isReady && entities.length > 0) {
      updateNodes(entities, connections);
    }
  }, [autoUpdate, state.isReady, entities, connections, updateNodes]);
  
  // Reset function
  const reset = useCallback(() => {
    if (!workerRef.current) return;
    
    const message: WorkerInputMessage = { type: "RESET" };
    workerRef.current.postMessage(message);
    positionsRef.current.clear();
    
    logger.info("Physics worker reset");
  }, []);
  
  // Pause function
  const pause = useCallback(() => {
    if (!workerRef.current) return;
    
    const message: WorkerInputMessage = { type: "PAUSE" };
    workerRef.current.postMessage(message);
    
    logger.debug("Physics worker paused");
  }, []);
  
  // Resume function
  const resume = useCallback(() => {
    if (!workerRef.current) return;
    
    const message: WorkerInputMessage = { type: "RESUME" };
    workerRef.current.postMessage(message);
    
    logger.debug("Physics worker resumed");
  }, []);
  
  // Get positions
  const getPositions = useCallback(() => {
    return positionsRef.current;
  }, []);
  
  return {
    state,
    updateNodes,
    reset,
    pause,
    resume,
    getPositions,
  };
}

/**
 * Fallback synchronous layout for when worker is unavailable
 * Uses the original spatialLayout.ts logic
 */
export function useFallbackLayout(
  entities: Entity[],
  connections: Connection[]
): Map<string, [number, number, number]> {
  // Import and use original layout function
  const positionsRef = useRef<Map<string, [number, number, number]>>(new Map());
  
  useEffect(() => {
    // Lazy import to avoid circular dependencies
    import("@/lib/spatialLayout").then(({ calculateOptimalLayout }) => {
      const positions = calculateOptimalLayout(entities, connections);
      positionsRef.current = positions;
    });
  }, [entities, connections]);
  
  return positionsRef.current;
}

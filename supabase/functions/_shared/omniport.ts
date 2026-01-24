/**
 * OmniPort Module
 *
 * TradeLine 24/7 is a CLIENT that connects to the OmniPort platform.
 * This module re-exports the client SDK for convenience.
 *
 * Usage:
 *   import { getOmniPortMetrics, sendToOmniPort } from "../_shared/omniport.ts";
 *
 *   // Fetch metrics from OmniPort platform
 *   const metrics = await getOmniPortMetrics("1h");
 *
 *   // Send event to OmniPort for processing
 *   const result = await sendToOmniPort({
 *     source: "voice",
 *     content: "Customer inquiry about account",
 *     userId: "user-123",
 *   });
 */

// Re-export everything from the client SDK
export {
  OmniPortClient,
  getOmniPortClient,
  getOmniPortMetrics,
  sendToOmniPort,
  type OmniPortSource,
  type OmniPortLane,
  type OmniPortHealthStatus,
  type OmniPortMetrics,
  type OmniPortEvent,
  type OmniPortIngestResponse,
  type OmniPortDevice,
} from "./omniport-client.ts";

// Default export for convenience
export { getOmniPortClient as default } from "./omniport-client.ts";

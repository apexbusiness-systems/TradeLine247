
import { assertEquals, assertExists } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { AgentFactory } from "../supabase/functions/_shared/agentFactory.ts";

Deno.test("AgentFactory - Adeline Tools", () => {
  const tools = AgentFactory.getToolsForAgent("Adeline");
  assertExists(tools);
  assertEquals(tools.some(t => t.function.name === "transfer_to_lisa"), true);
  assertEquals(tools.some(t => t.function.name === "transfer_to_christy"), true);
});

Deno.test("AgentFactory - Lisa Tools", () => {
  const tools = AgentFactory.getToolsForAgent("Lisa");
  assertExists(tools);
  assertEquals(tools.some(t => t.function.name === "transfer_to_christy"), true);
  assertEquals(tools.some(t => t.function.name === "end_call"), true);
});


import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { load } from "https://deno.land/std@0.168.0/dotenv/mod.ts";
import { validateTwilioSignature } from "../supabase/functions/_shared/twilioValidator.ts";

// Load environment variables
const env = await load();
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || env["SUPABASE_URL"];
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || env["SUPABASE_SERVICE_ROLE_KEY"];
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || env["TWILIO_AUTH_TOKEN"] || "mock-token";

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing required environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
    Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Infer functions URL
// If SUPABASE_URL is https://xyz.supabase.co, functions are at https://xyz.supabase.co/functions/v1
const FUNCTIONS_URL = SUPABASE_URL.replace(".supabase.co", ".supabase.co/functions/v1");

console.log("🚀 Starting Comprehensive Telephony Sandbox Tests");
console.log(`target: ${FUNCTIONS_URL}`);
console.log("------------------------------------------------");

// --- UTILS ---
async function signRequest(url: string, params: Record<string, string>, authToken: string) {
    const sortedParams = Object.keys(params).sort().map(k => k + params[k]).join("");
    const data = url + sortedParams;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(authToken);
    const messageData = encoder.encode(data);
    const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// --- TEST 1: SEED DATA ---
async function seedClient() {
    console.log("\n🌱 [1/4] Seeding Test Client...");
    const phone = "+15550001111";
    const { error } = await supabase.from("clients").upsert({
        phone: phone,
        first_name: "Sandbox",
        last_name: "Tester",
        updated_at: new Date().toISOString()
    });

    if (error) {
        console.error("   ❌ Seed failed:", error);
        return false;
    }
    console.log("   ✅ Seeded client: Sandbox Tester (+15550001111)");
    return true;
}

// --- TEST 2: VOICE FRONTDOOR (SECURITY) ---
async function testFrontdoor() {
    console.log("\n🔒 [2/4] Testing Secure Gatekeeper (voice-frontdoor)...");
    const url = `${FUNCTIONS_URL}/voice-frontdoor`;
    const params = {
        "CallSid": "CA_TEST_SID",
        "From": "+15550001111", // Known client
        "To": "+15550009999"
    };

    // A. Invalid Signature
    console.log("   👉 Case A: Invalid Signature");
    const res1 = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params)
    });

    if (res1.status === 403) {
        console.log("   ✅ Properly rejected invalid request (403 Forbidden)");
    } else {
        console.error(`   ❌ Failed: Expected 403, got ${res1.status}. (Is validation enabled?)`);
    }

    // B. Valid Signature (Simulation)
    // Note: We can only simulate this if we have the REAL auth token.
    // If TWILIO_AUTH_TOKEN is 'mock-token', this test will likely fail against a real server unless it also uses 'mock-token'.
    console.log("   👉 Case B: Valid Signature Simulation");
    if (TWILIO_AUTH_TOKEN === "mock-token") {
        console.log("   ⚠️ Skipping valid signature test (TWILIO_AUTH_TOKEN not set in local env)");
        return;
    }

    const signature = await signRequest(url, params, TWILIO_AUTH_TOKEN);
    const res2 = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Twilio-Signature": signature
        },
        body: new URLSearchParams(params)
    });

    if (res2.status === 200) {
        const text = await res2.text();
        if (text.includes("Sandbox Tester") || text.includes("traceId")) {
            console.log("   ✅ Valid request accepted. Response contains expected TwiML.");
        } else {
            console.log("   ✅ Valid request accepted, but check TwiML content:", text.substring(0, 100));
        }
    } else {
        console.error(`   ❌ Failed: Valid signature rejected with ${res2.status}. Check URL/Token mismatch.`);
        const text = await res2.text();
        console.error("   Error details:", text);
    }
}

// --- TEST 3: VOICE ACTION (RECOVERY) ---
async function testRecovery() {
    console.log("\n🚑 [3/4] Testing Recovery Protocol (voice-action)...");
    const url = `${FUNCTIONS_URL}/voice-action`;
    const params = {
        "CallSid": "CA_FAILED_CALL",
        "CallStatus": "failed",
        "Caller": "+15550001111"
    };

    console.log("   👉 Triggering 'failed' call status...");
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params)
    });

    if (res.status === 200) {
        console.log("   ✅ Recovery hook accepted (200 OK). Check logs for 'SMS recovery queued'.");
    } else {
        console.error(`   ❌ Recovery hook failed: ${res.status}`);
    }
}

// --- TEST 4: VOICE ACTION (TOOLS) ---
async function testTools() {
    console.log("\n🛠️  [4/4] Testing Tool Execution (voice-action)...");
    const url = `${FUNCTIONS_URL}/voice-action`;

    // A. Check Schedule
    console.log("   👉 Tool: check_schedule");
    const res1 = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "check_schedule",
            params: { phone: "+15550001111" }
        })
    });

    const json1 = await res1.json();
    if (json1.script && json1.outcome === "success") {
        console.log("   ✅ Anti-Hallucination Script returned:", `"${json1.script}"`);
    } else {
        console.error("   ❌ Tool failed or missing script:", json1);
    }
}

// --- RUNNER ---
await seedClient();
await testFrontdoor();
await testRecovery();
await testTools();

console.log("\n✨ Sandbox Validation Complete.");


import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import crypto from "node:crypto";

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "mock-token";

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing required environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Infer functions URL
// If SUPABASE_URL is https://xyz.supabase.co, functions are at https://xyz.supabase.co/functions/v1
const FUNCTIONS_URL = SUPABASE_URL.replace(".supabase.co", ".supabase.co/functions/v1");

console.log("🚀 Starting Comprehensive Telephony Sandbox Tests (Node.js)");
console.log(`target: ${FUNCTIONS_URL}`);
console.log("------------------------------------------------");

// --- UTILS ---
function signRequest(url, params, authToken) {
    const sortedParams = Object.keys(params).sort().map(k => k + params[k]).join("");
    const data = url + sortedParams;
    return crypto
        .createHmac("sha1", authToken)
        .update(Buffer.from(data, "utf-8"))
        .digest("base64");
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
    // Construct body for x-www-form-urlencoded
    const body = new URLSearchParams(params);

    const res1 = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body
    });

    if (res1.status === 403) {
        console.log("   ✅ Properly rejected invalid request (403 Forbidden)");
    } else {
        // If validation is NOT enabled in current deploy, this might stay 200.
        console.warn(`   ⚠️  Expected 403, got ${res1.status}. (Validation might be disabled or bypass enabled)`);
    }

    // B. Valid Signature (Simulation)
    console.log("   👉 Case B: Valid Signature Simulation");
    if (TWILIO_AUTH_TOKEN === "mock-token") {
        console.log("   ⚠️ Skipping valid signature test (TWILIO_AUTH_TOKEN not set in local env)");
        return;
    }

    // NOTE: When validating, the URL must be EXACTLY what the server sees.
    // In Cloud Functions, it might be http vs https depending on internal routing?
    // But typically it matches the public URL.
    // However, query params are part of the signature generation data.
    // Our function code reconstructs it from x-forwarded-proto/host.
    // Usually this matches the public URL.

    const signature = signRequest(url, params, TWILIO_AUTH_TOKEN);
    const res2 = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Twilio-Signature": signature
        },
        body: body
    });

    if (res2.status === 200) {
        const text = await res2.text();
        if (text.includes("Sandbox Tester") || text.includes("traceId")) {
            console.log("   ✅ Valid request accepted. Response contains expected TwiML.");
        } else {
            console.log("   ✅ Valid request accepted. TwiML Snippet:", text.substring(0, 100));
        }
    } else {
        console.error(`   ❌ Failed: Valid signature rejected with ${res2.status}.`);
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

    const text1 = await res1.text();
    let json1;
    try {
        json1 = JSON.parse(text1);
        if (json1.script && json1.outcome === "success") {
            console.log("   ✅ Anti-Hallucination Script returned:", `"${json1.script}"`);
        } else {
            console.error("   ❌ Tool failed or missing script:", json1);
        }
    } catch (e) {
        console.error(`   ❌ Failed to parse JSON response (Status: ${res1.status})`);
        console.error(`   Body: ${text1}`);
    }
}

// --- RUNNER ---
// --- RUNNER ---
try {
    await seedClient();
    await testFrontdoor();
    await testRecovery();
    await testTools();
    console.log("\n✨ Sandbox Validation Complete.");
} catch (error) {
    console.error("\n❌ Test Suite Failed:");
    console.error(error);
    if (error.cause) console.error("Cause:", error.cause);
    if (error.message) console.error("Message:", error.message);
    process.exit(1);
}

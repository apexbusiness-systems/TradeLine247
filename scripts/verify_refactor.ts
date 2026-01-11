
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CONFIG ---
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Env Vars");
    Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const TEST_TITLE = `QA_VERIFY_${Date.now()}`;

async function runTest() {
    console.log(`🧪 Starting QA Verification: ${TEST_TITLE}`);

    // 1. Seed Data
    console.log("   ➤ Seeding test document...");
    const { data: doc, error: seedErr } = await supabase
        .from('kb_documents')
        .insert({
            org_id: '00000000-0000-0000-0000-000000000000',
            title: TEST_TITLE,
            text: 'QA Verification Content for Refactor Robustness',
            checksum: 'qa_check_1',
        })
        .select()
        .single();

    if (seedErr) {
        console.error("   ❌ Seed Failed:", seedErr);
        Deno.exit(1);
    }
    console.log(`   ✅ Seeded Doc ID: ${doc.id}`);

    // 2. Trigger Ingestion (Run local_ingest.ts as subprocess)
    console.log("   ➤ Triggering Ingestion Process...");
    const command = new Deno.Command(Deno.execPath(), {
        args: ["run", "--allow-all", "--no-lock", "scripts/local_ingest.ts"],
        env: {
            SUPABASE_URL: supabaseUrl!,
            SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey!,
            OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY')!
        }
    });

    const { code, stdout, stderr } = await command.output();

    if (code !== 0) {
        console.error("   ❌ Ingestion Script Failed");
        console.error(new TextDecoder().decode(stderr));
        Deno.exit(1);
    }
    // console.log(new TextDecoder().decode(stdout)); // Optional: verify output
    console.log("   ✅ Ingestion Script Completed");

    // 3. Assert State
    console.log("   ➤ Verifying Database State...");
    const { data: verifiedDoc, error: verifyErr } = await supabase
        .from('kb_documents')
        .select('embedding')
        .eq('id', doc.id)
        .single();

    if (verifyErr || !verifiedDoc) {
        console.error("   ❌ Verification Query Failed:", verifyErr);
        Deno.exit(1);
    }

    if (verifiedDoc.embedding && verifiedDoc.embedding.length > 0) {
        console.log("   ✅ SUCCESS: Embedding generated and stored.");

        // Cleanup
        console.log("   ➤ Cleaning up...");
        await supabase.from('kb_documents').delete().eq('id', doc.id);
        console.log("   ✅ Cleanup Complete.");

    } else {
        console.error("   ❌ FAILURE: Embedding is NULL after ingestion.");
        Deno.exit(1);
    }
}

await runTest();

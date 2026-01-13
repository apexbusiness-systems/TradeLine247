
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.");
    console.error("   Please set them in your environment or .env file before running this script.");
    Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runOptimization() {
    console.log("🚀 Starting RAG Performance Analysis (rag-optimize)...");

    try {
        const { data, error } = await supabase.functions.invoke('rag-optimize', {
            body: {
                action: 'full_report',
                days: 7,
                threshold_ms: 500
            }
        });

        if (error) {
            console.error("❌ Optimization invocation failed with error:", error);

            if (error instanceof Error) {
                console.error("   Message:", error.message);
            }
            return;
        }

        if (!data.success) {
            console.error("❌ Optimization function returned failure:", data.error);
            return;
        }

        console.log("✅ Analysis Complete. Full Report:");
        console.log("----------------------------------------");
        console.log(JSON.stringify(data.data, null, 2));
        console.log("----------------------------------------");

        // Print summary specifically
        if (data.data && data.data.executive_summary) {
            console.log("\n📊 Executive Summary:");
            const sum = data.data.executive_summary;
            console.log(`- Slow Queries Found: ${sum.total_slow_queries}`);
            console.log(`- High Priority Issues: ${sum.high_priority_issues}`);
            console.log(`- Pre-computation Candidates: ${sum.precompute_candidates}`);
        }

    } catch (err) {
        console.error("❌ Unexpected error running optimization:", err);
    }
}

await runOptimization();

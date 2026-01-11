
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.");
    Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runIngestion() {
    console.log("🚀 Starting RAG Ingestion (rag-ingest)...");
    console.log("Sources: Transcripts, FAQs");

    try {
        const { data, error } = await supabase.functions.invoke('rag-ingest', {
            body: {
                source_types: ['transcript', 'faq']
            },
            headers: {
                Authorization: `Bearer ${supabaseServiceKey}`
            }
        });

        if (error) {
            console.error("❌ Ingestion invocation failed with error:", error);
            if (error instanceof Error) {
                console.error("   Message:", error.message);
            }
            // Check if it's an HTTP error masked as a function error
            if (error && typeof error === 'object' && 'context' in error) {
                console.error("   Context:", JSON.stringify((error as any).context, null, 2));
            }
            return;
        }

        if (!data.ok) {
            console.error("❌ Ingestion function returned failure:", data.error);
            return;
        }

        console.log("✅ Ingestion Complete. Results:");
        console.log("----------------------------------------");
        console.log(`- Processed Items: ${data.results.processed}`);
        console.log(`- Chunks Created: ${data.results.chunks_created}`);
        console.log(`- Embeddings Generated: ${data.results.embeddings_created}`);
        console.log("----------------------------------------");
        console.log("Breakdown by Type:");
        console.table(data.results.by_type);

    } catch (err) {
        console.error("❌ Unexpected error running ingestion:", err);
    }
}

await runIngestion();

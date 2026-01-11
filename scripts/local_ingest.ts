
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- ENV VARS ---
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const openaiKey = Deno.env.get('OPENAI_API_KEY');

if (!supabaseUrl || !supabaseServiceKey || !openaiKey) {
    console.error("❌ Error: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and OPENAI_API_KEY are required.");
    Deno.exit(1);
}

// --- HELPER FUNCIONS ---
async function generateEmbedding(text: string, key: string): Promise<number[]> {
    // Use replaceAll with regex if supported, or stick to replace with global flag.
    // Linter S7781 suggests replaceAll.
    const normalized = text.replace(/\s+/g, ' ').trim();
    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: normalized,
            dimensions: 1536,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
}

function chunkText(text: string, targetTokens = 800): string[] {
    const chunkSize = targetTokens * 4;
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function syncTranscriptions(openaiKey: string) {
    // 1. Fetch Source Data (call_transcriptions)
    const { data: transcriptions, error: tErr } = await supabase
        .from('call_transcriptions')
        .select('id, call_sid, tenant_id, transcript_text')
        .not('transcript_text', 'is', null)
        .limit(50); // Batch size

    if (tErr) {
        console.error("❌ Error fetching source transcriptions:", tErr);
        return;
    }

    if (!transcriptions || transcriptions.length === 0) {
        console.log("   No source transcriptions found.");
        return;
    }

    for (const t of transcriptions) {
        console.log(`   Processing: ${t.call_sid}`);

        // 2. Ensure RAG 'calls' entry exists
        const { data: existingCall, error: callFindErr } = await supabase
            .from('calls')
            .select('id')
            .eq('twilio_call_sid', t.call_sid)
            .maybeSingle();

        if (callFindErr) {
            console.error(`     ❌ Error checking calls table:`, callFindErr);
            continue;
        }

        let callId = existingCall?.id;

        if (!callId) {
            // Insert new RAG call entry
            console.log(`     Creating RAG 'calls' entry...`);
            const { data: newCall, error: createCallErr } = await supabase
                .from('calls')
                .insert({
                    org_id: t.tenant_id,
                    twilio_call_sid: t.call_sid,
                })
                .select('id')
                .single();

            if (createCallErr) {
                console.error(`     ❌ Failed to create RAG call entry:`, createCallErr);
                continue;
            }
            callId = newCall.id;
        }

        // 3. Check for existing Chunks
        const { count } = await supabase
            .from('call_chunks')
            .select('*', { count: 'exact', head: true })
            .eq('call_id', callId);

        if (count && count > 0) {
            continue;
        }

        // 4. Chunk & Embed
        const chunks = chunkText(t.transcript_text);
        let chunkIdx = 0;

        for (const chunkContent of chunks) {
            try {
                const embedding = await generateEmbedding(chunkContent, openaiKey);

                const { error: insertErr } = await supabase
                    .from('call_chunks')
                    .insert({
                        org_id: t.tenant_id,
                        call_id: callId,
                        chunk_index: chunkIdx++,
                        content: chunkContent,
                        embedding: `[${embedding.join(',')}]`,
                        metadata: { source: 'transcript', original_id: t.id }
                    });

                if (insertErr) console.error(`     ❌ Chunk insert failed:`, insertErr);
                else process.stdout.write('.');

            } catch (e) {
                console.error(`     ❌ Embedding failed:`, e);
            }
        }
        console.log("");
    }
}

async function syncKBDocs(openaiKey: string) {
    console.log("\n📥 Checking KB Documents...");
    const { data: docs, error: dErr } = await supabase
        .from('kb_documents')
        .select('id, title, text')
        .is('embedding', null)
        .limit(50);

    if (dErr) {
        console.error("❌ Error fetching kb_documents:", dErr);
        return;
    }

    if (!docs || docs.length === 0) {
        console.log("   No KB documents pending embedding.");
        return;
    }

    console.log(`   Found ${docs.length} KB docs missing embeddings.`);
    for (const doc of docs) {
        console.log(`   Embedding Doc: ${doc.title}...`);
        try {
            const embedding = await generateEmbedding(doc.text, openaiKey);
            await supabase
                .from('kb_documents')
                .update({ embedding: `[${embedding.join(',')}]` })
                .eq('id', doc.id);
        } catch (e) {
            console.error(`     ❌ Failed:`, e);
        }
    }
}

// --- MAIN SCRIPT ---
async function runLocalIngestion() {
    console.log("🚀 Starting LOCAL RAG Ingestion (Sync Mode)...");
    console.log("------------------------------------------------");
    console.log("Goal: Sync 'call_transcriptions' (Ops) -> 'call_chunks' (RAG)");

    await syncTranscriptions(openaiKey!);
    await syncKBDocs(openaiKey!);

    console.log("\n✅ Sync Complete.");
}

await runLocalIngestion();

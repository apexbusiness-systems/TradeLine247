
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- ENV VARS ---
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const openaiKey = Deno.env.get('OPENAI_API_KEY');

if (!supabaseUrl || !supabaseServiceKey || !openaiKey) {
    console.error("❌ Error: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and OPENAI_API_KEY are required.");
    Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- HELPER FUNCIONS ---

function writeProgressDot(): void {
    try {
        Deno.stdout.writeSync(new TextEncoder().encode('.'));
    } catch {
        // no-op (e.g., redirected output)
    }
}

async function generateEmbedding(text: string, key: string): Promise<number[]> {
    // Use replaceAll with regex if supported (ES2021+), ensures global replacement explicitly.
    const normalized = text.replaceAll(/\s+/g, ' ').trim();
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

// --- ORCHESTRATION HELPERS ---

type TranscriptionRow = {
    id: string;
    call_sid: string;
    tenant_id: string;
    transcript_text: string;
};

type KbDocRow = { id: string; title: string; text: string };

async function fetchTranscriptions(batchSize = 50): Promise<TranscriptionRow[]> {
    const { data, error } = await supabase
        .from('call_transcriptions')
        .select('id, call_sid, tenant_id, transcript_text')
        .not('transcript_text', 'is', null)
        .limit(batchSize);

    if (error) {
        console.error("❌ Error fetching source transcriptions:", error);
        return [];
    }
    return (data ?? []) as TranscriptionRow[];
}

async function getOrCreateCallId(t: TranscriptionRow): Promise<string | null> {
    const { data: existingCall, error: callFindErr } = await supabase
        .from('calls')
        .select('id')
        .eq('twilio_call_sid', t.call_sid)
        .maybeSingle();

    if (callFindErr) {
        console.error("     ❌ Error checking calls table:", callFindErr);
        return null;
    }
    if (existingCall?.id) return existingCall.id;

    console.log("     Creating RAG 'calls' entry...");
    const { data: newCall, error: createCallErr } = await supabase
        .from('calls')
        .insert({ org_id: t.tenant_id, twilio_call_sid: t.call_sid })
        .select('id')
        .single();

    if (createCallErr) {
        console.error("     ❌ Failed to create RAG call entry:", createCallErr);
        return null;
    }
    return newCall.id;
}

async function callAlreadyChunked(callId: string): Promise<boolean> {
    const { count, error } = await supabase
        .from('call_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('call_id', callId);

    if (error) {
        console.error("     ❌ Error checking call_chunks:", error);
        return true; // safe default prevents duping on transient errors
    }
    return !!count && count > 0;
}

async function insertChunksForTranscription(
    t: TranscriptionRow,
    callId: string,
    openaiKey: string
): Promise<void> {
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

            if (insertErr) console.error("     ❌ Chunk insert failed:", insertErr);
            else writeProgressDot();
        } catch (e) {
            console.error("     ❌ Embedding failed:", e);
        }
    }
    console.log("");
}

async function syncTranscriptionsToCallChunks(openaiKey: string): Promise<void> {
    console.log("Goal: Sync 'call_transcriptions' (Ops) -> 'call_chunks' (RAG)");
    const transcriptions = await fetchTranscriptions(50);

    if (transcriptions.length === 0) {
        console.log("   No source transcriptions found.");
        return;
    }

    for (const t of transcriptions) {
        console.log(`   Processing: ${t.call_sid}`);
        const callId = await getOrCreateCallId(t);
        if (!callId) continue;

        const already = await callAlreadyChunked(callId);
        if (already) continue;

        await insertChunksForTranscription(t, callId, openaiKey);
    }
}

async function fetchKbDocsMissingEmbeddings(batchSize = 50): Promise<KbDocRow[]> {
    const { data, error } = await supabase
        .from('kb_documents')
        .select('id, title, text')
        .is('embedding', null)
        .limit(batchSize);

    if (error) {
        console.error("❌ Error fetching kb_documents:", error);
        return [];
    }
    return (data ?? []) as KbDocRow[];
}

async function embedPendingKbDocuments(openaiKey: string): Promise<void> {
    console.log("\n📥 Checking KB Documents...");
    const docs = await fetchKbDocsMissingEmbeddings(50);

    if (docs.length === 0) {
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
            console.error("     ❌ Failed:", e);
        }
    }
}

// --- MAIN SCRIPT ---
async function runLocalIngestion() {
    console.log("🚀 Starting LOCAL RAG Ingestion (Sync Mode)...");
    console.log("------------------------------------------------");
    await syncTranscriptionsToCallChunks(openaiKey!);
    await embedPendingKbDocuments(openaiKey!);
    console.log("\n✅ Sync Complete.");
}

await runLocalIngestion();

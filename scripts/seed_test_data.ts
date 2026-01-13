
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log("🌱 Seeding Test KB Document...");
const { data, error } = await supabase
    .from('kb_documents')
    .insert({
        org_id: '00000000-0000-0000-0000-000000000000', // Dummy Org
        title: 'Test Document',
        text: 'This is a test document to verify RAG embedding generation.',
        checksum: 'test_checksum_1',
        // embedding: null (should be filled by ingest)
    })
    .select()
    .single();

if (error) {
    console.error("❌ Seed failed:", error);
} else {
    console.log("✅ Seed success. Created Doc ID:", data.id);
}

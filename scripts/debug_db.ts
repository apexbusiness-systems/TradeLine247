
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTable(tableName: string) {
    console.log(`Checking table: ${tableName}...`);
    // Try simple select
    const { data, error } = await supabase.from(tableName).select('id').limit(1);

    let msg = "";
    if (error) {
        msg = `❌ Error accessing ${tableName}: ${error.message} (${error.code})\n`;
    } else {
        msg = `✅ Success accessing ${tableName}. Rows found: ${data?.length ?? 0}\n`;
    }
    console.log(msg.trim());
    await Deno.writeTextFile("debug_output.txt", msg, { append: true });
}

// Clear file first
await Deno.writeTextFile("debug_output.txt", "");


async function run() {
    await checkTable('call_logs');
    await checkTable('call_transcriptions');
    await checkTable('calls');
    await checkTable('call_chunks');
    await checkTable('kb_documents');
    await checkTable('non_existent_table_xyz'); // Control check
}

run();

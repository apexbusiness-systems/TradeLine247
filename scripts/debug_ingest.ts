
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing env vars");
    Deno.exit(1);
}

const functionUrl = `${supabaseUrl}/functions/v1/rag-ingest`;

console.log(`invoking ${functionUrl}...`);

const res = await fetch(functionUrl, {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({ source_types: ['transcript'] })
});

console.log(`Status: ${res.status} ${res.statusText}`);
const text = await res.text();
console.log(`Body: ${text.substring(0, 500)}`);

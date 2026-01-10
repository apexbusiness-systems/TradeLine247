
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function getSystemPrompt(agentName: "Adeline" | "Lisa" | "Christy"): Promise<string> {
  const filename = `${agentName}.md`;

  // Try loading from shared prompts directory
  try {
    // Files are in ./prompts relative to this file
    const promptPath = new URL(`./prompts/${filename}`, import.meta.url);
    const text = await Deno.readTextFile(promptPath);
    return text;
  } catch (error) {
    console.error(`Error loading prompt for ${agentName}:`, error);
    throw new Error(`Could not load system prompt for ${agentName}`);
  }
}

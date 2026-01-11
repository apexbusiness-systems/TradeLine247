
-- =================================================================
-- RAG SYSTEM FIX SCRIPT
-- Purpose: Create missing tables for RAG (KB, Calls, Chunks)
-- Reason: Migrations 20250925 and 20251219 were not applied.
--         'calls' table exists but is malformed (missing columns).
-- =================================================================

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create KB Tables (from 20250925)
CREATE TABLE IF NOT EXISTS public.kb_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  text TEXT NOT NULL,
  checksum TEXT NOT NULL,
  embedding vector(1536), 
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kb_documents_embedding_idx ON public.kb_documents USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS kb_documents_org_id_idx ON public.kb_documents (org_id);
ALTER TABLE public.kb_documents ENABLE ROW LEVEL SECURITY;

-- 3. Fix 'calls' Table (from 20251219)
-- WARNING: The existing 'calls' table is malformed (missing id). We must replace it.
DROP TABLE IF EXISTS calls CASCADE;

CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL, -- references orgs(id) removed to avoid dependency hell if orgs missing
  user_id uuid, -- references auth.users(id) removed
  twilio_call_sid text UNIQUE NOT NULL,
  from_number text NOT NULL DEFAULT '',
  to_number text NOT NULL DEFAULT '',
  status text DEFAULT 'processing',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Create Call Chunks (from 20251219)
CREATE TABLE IF NOT EXISTS call_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(1536),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_chunks_embedding ON call_chunks USING hnsw (embedding vector_cosine_ops);
ALTER TABLE call_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- 5. Helper Tables (Simplified)
CREATE TABLE IF NOT EXISTS call_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  transcript_text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- End of Fix

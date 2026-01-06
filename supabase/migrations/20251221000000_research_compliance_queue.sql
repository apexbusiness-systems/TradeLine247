-- Queue table for decoupled high-latency tasks (Blockchain Anchoring)
CREATE TABLE IF NOT EXISTS background_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- e.g., 'BLOCKCHAIN_ANCHOR'
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Index for faster worker lookups
CREATE INDEX IF NOT EXISTS idx_background_tasks_status ON background_tasks(status);

-- Enable RLS (Service Role only)
ALTER TABLE background_tasks ENABLE ROW LEVEL SECURITY;

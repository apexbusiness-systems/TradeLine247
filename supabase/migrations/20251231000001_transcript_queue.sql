
-- Migration for transcript queue

CREATE TABLE IF NOT EXISTS transcript_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_sid TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_transcript_queue_processed ON transcript_queue(processed);

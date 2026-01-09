-- Extend voice_stream_logs table with enhanced telemetry fields
-- Phase 1: Diagnostics & Telemetry Enhancement

ALTER TABLE voice_stream_logs
ADD COLUMN IF NOT EXISTS twilio_start_ms bigint,
ADD COLUMN IF NOT EXISTS openai_connect_ms bigint,
ADD COLUMN IF NOT EXISTS first_byte_latency_ms integer,
ADD COLUMN IF NOT EXISTS message_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS silence_nudges integer DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN voice_stream_logs.twilio_start_ms IS 'Timestamp when Twilio WebSocket connection was established (ms since epoch)';
COMMENT ON COLUMN voice_stream_logs.openai_connect_ms IS 'Timestamp when OpenAI WebSocket connection was established (ms since epoch)';
COMMENT ON COLUMN voice_stream_logs.first_byte_latency_ms IS 'Time from user speech end to first AI audio byte (ms)';
COMMENT ON COLUMN voice_stream_logs.message_count IS 'Total number of WebSocket messages processed';
COMMENT ON COLUMN voice_stream_logs.silence_nudges IS 'Number of silence detection nudges sent during call';
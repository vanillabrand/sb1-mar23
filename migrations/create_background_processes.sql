CREATE TABLE public.background_processes (
    process_id TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('active', 'error', 'stopped')),
    last_heartbeat TIMESTAMP WITH TIME ZONE NOT NULL,
    last_error TEXT,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_background_processes_status ON public.background_processes(status);
CREATE INDEX idx_background_processes_heartbeat ON public.background_processes(last_heartbeat);

-- Trigger to update updated_at
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.background_processes
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
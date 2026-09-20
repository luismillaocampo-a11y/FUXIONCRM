-- Fuxion Flow CRM Database Schema for PostgreSQL / Supabase

-- Leads Table
CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT,
    phone TEXT UNIQUE NOT NULL,
    whatsapp_lid TEXT,
    real_phone TEXT, -- teléfono real cuando phone guarda un LID temporal
    last_product TEXT, -- último producto recomendado por el bot (Fase 1 pedidos)
    last_order_qty INTEGER, -- unidades del último pedido congelado (Fase 2)
    last_order_total REAL, -- total S/ del último pedido congelado (Fase 2)
    last_order_at TIMESTAMP, -- cuándo se congeló el pedido
    status TEXT NOT NULL DEFAULT 'New', -- 'New', 'Engaged', 'Pending Verification', 'Converted'
    tags TEXT NOT NULL DEFAULT '[]', -- JSON array of tags: '["warm", "needs-followup"]'
    bot_active INTEGER NOT NULL DEFAULT 1, -- 1 = active, 0 = paused/shadow mode
    channel TEXT NOT NULL DEFAULT 'whatsapp', -- 'whatsapp' | 'instagram' | 'facebook'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Automation Flows Table
CREATE TABLE IF NOT EXISTS flows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nodes TEXT NOT NULL, -- JSON string of nodes
    edges TEXT NOT NULL, -- JSON string of edges
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Multimedia Knowledge Base Table
CREATE TABLE IF NOT EXISTS knowledge_base (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'pdf', 'txt', 'image', 'mp4'
    content TEXT, -- Parsed raw content
    summary TEXT, -- Model-generated summary
    file_path TEXT, -- Storage location or simulated path
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Gaps Table (for Shadow Mode)
CREATE TABLE IF NOT EXISTS knowledge_gaps (
    id TEXT PRIMARY KEY,
    lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
    question TEXT NOT NULL,
    context TEXT, -- Conversation history snippet
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'resolved'
    answer TEXT, -- Admin's answered content
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    sender TEXT NOT NULL, -- 'customer', 'bot', 'agent'
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Required for Supabase Realtime postgres_changes on chat_messages (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
  END IF;
END $$;

-- WhatsApp Sessions Table (stores auth state for Baileys)
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id TEXT PRIMARY KEY,
    creds JSONB,
    keys JSONB,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lead Notes Table
CREATE TABLE IF NOT EXISTS lead_notes (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reminders Table
CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    scheduled_at TIMESTAMP NOT NULL,
    sent INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Broadcasts Table
CREATE TABLE IF NOT EXISTS broadcasts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    targets JSONB,
    status TEXT NOT NULL DEFAULT 'pending',
    sent_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users Table (for Authentication)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Behavior Rules Table (mirrors SQLite ai_rules in lib/db.ts)
CREATE TABLE IF NOT EXISTS ai_rules (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    instruction TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WhatsApp Status Library Table (mirrors SQLite whatsapp_status_library)
CREATE TABLE IF NOT EXISTS whatsapp_status_library (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    product_name TEXT,
    category TEXT,
    tags JSONB DEFAULT '[]',
    media_url TEXT NOT NULL,
    media_type TEXT DEFAULT 'image',
    caption TEXT,
    internal_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WhatsApp Status Schedules Table (mirrors SQLite whatsapp_status_schedules)
CREATE TABLE IF NOT EXISTS whatsapp_status_schedules (
    id TEXT PRIMARY KEY,
    library_id TEXT,
    media_url TEXT NOT NULL,
    media_type TEXT DEFAULT 'image',
    caption TEXT,
    scheduled_at TIMESTAMP,
    recurrence_type TEXT DEFAULT 'none',
    recurrence_days JSONB DEFAULT '[]',
    status TEXT DEFAULT 'pending',
    published_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


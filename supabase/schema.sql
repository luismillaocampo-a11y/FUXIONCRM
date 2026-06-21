-- Fuxion Flow CRM Database Schema for PostgreSQL / Supabase

-- Leads Table
CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT,
    phone TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'New', -- 'New', 'Engaged', 'Pending Verification', 'Converted'
    tags TEXT NOT NULL DEFAULT '[]', -- JSON array of tags: '["warm", "needs-followup"]'
    bot_active INTEGER NOT NULL DEFAULT 1, -- 1 = active, 0 = paused/shadow mode
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Required for Supabase Realtime postgres_changes on chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- WhatsApp Sessions Table (stores auth state for Baileys)
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id TEXT PRIMARY KEY,
    creds JSONB,
    keys JSONB,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

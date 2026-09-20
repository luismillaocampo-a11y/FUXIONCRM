const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'lib/db.ts');
let content = fs.readFileSync(dbPath, 'utf-8');

const kbAndGapsSection = `
  // --- KNOWLEDGE BASE ---
  async getKBItems(): Promise<any[]> {
    if (useSupabase && supabase) {
      const res = await runSupabaseQuery((c) => c.from('knowledge_base').select('*').order('created_at', { ascending: false }));
      if (res && !res.error && res.data) return res.data;
    }
    const sqlite = getSqliteDb();
    if (sqlite) {
      try {
        return sqlite.prepare('SELECT * FROM knowledge_base ORDER BY created_at DESC').all();
      } catch (e) {}
    }
    return localJsonDb.getKBItems();
  },

  async saveKBItem(title: string, fileType: string, content?: string, summary?: string, filePath?: string): Promise<any> {
    const id = \`kb-\${Date.now()}\`;
    if (useSupabase && supabase) {
      await runSupabaseQuery((c) => c.from('knowledge_base').insert({
        id,
        title,
        file_type: fileType,
        content: content || '',
        summary: summary || '',
        file_path: filePath || null
      }));
    }
    const sqlite = getSqliteDb();
    if (sqlite) {
      try {
        sqlite.prepare(\`
          INSERT INTO knowledge_base (id, title, file_type, content, summary, file_path)
          VALUES (?, ?, ?, ?, ?, ?)
        \`).run(id, title, fileType, content || '', summary || '', filePath || null);
      } catch (e) {}
    }
    return localJsonDb.saveKBItem(title, fileType, content, summary, filePath);
  },

  async addKBItem(id: string, title: string, fileType: string, content: string, summary: string, filePath: string): Promise<any> {
    if (useSupabase && supabase) {
      await runSupabaseQuery((c) => c.from('knowledge_base').insert({
        id,
        title,
        file_type: fileType,
        content,
        summary,
        file_path: filePath
      }));
    }
    const sqlite = getSqliteDb();
    if (sqlite) {
      try {
        sqlite.prepare(\`
          INSERT INTO knowledge_base (id, title, file_type, content, summary, file_path)
          VALUES (?, ?, ?, ?, ?, ?)
        \`).run(id, title, fileType, content, summary, filePath);
      } catch (e) {}
    }
    return localJsonDb.saveKBItem(title, fileType, content, summary, filePath);
  },

  async deleteKBItem(id: string): Promise<void> {
    if (useSupabase && supabase) {
      await runSupabaseQuery((c) => c.from('knowledge_base').delete().eq('id', id));
    }
    const sqlite = getSqliteDb();
    if (sqlite) {
      try {
        sqlite.prepare('DELETE FROM knowledge_base WHERE id = ?').run(id);
      } catch (e) {}
    }
    localJsonDb.deleteKBItem(id);
  },

  // --- KNOWLEDGE GAPS ---
  async getGaps(): Promise<any[]> {
    if (useSupabase && supabase) {
      const res = await runSupabaseQuery((c) => c.from('knowledge_gaps').select('*, leads(name, phone)').order('created_at', { ascending: false }));
      if (res && !res.error && res.data) return res.data;
    }
    const sqlite = getSqliteDb();
    if (sqlite) {
      try {
        const gaps = sqlite.prepare('SELECT * FROM knowledge_gaps ORDER BY created_at DESC').all();
        return gaps.map((gap: any) => {
          const lead = gap.lead_id ? sqlite.prepare('SELECT name, phone FROM leads WHERE id = ?').get(gap.lead_id) : null;
          return {
            ...gap,
            leads: lead || null
          };
        });
      } catch (e) {}
    }
    return [];
  },

  async addGap(id: string, leadId: string | null, question: string, context: string): Promise<any> {
    const realLeadId = leadId ? await this.normalizeLeadId(leadId) : null;

    try {
      const existingGaps = await this.getGaps();
      const pendingGaps = existingGaps.filter((g: any) => g.status === 'pending');
      const duplicate = pendingGaps.find((g: any) => areQuestionsSimilar(g.question, question));
      if (duplicate) {
        console.log(\`[db.addGap] Ya existe una duda pendiente similar (ID: \${duplicate.id}). Omitiendo creación para: "\${question}"\`);
        return duplicate;
      }
    } catch (err) {
      console.error('Error al verificar duplicados de dudas en addGap:', err);
    }

    if (useSupabase && supabase) {
      const res = await runSupabaseQuery((c) => c.from('knowledge_gaps').insert({
        id,
        lead_id: realLeadId,
        question,
        context,
        status: 'pending'
      }).select().single());
      if (res && !res.error && res.data) return res.data;
    }

    const sqlite = getSqliteDb();
    if (sqlite) {
      try {
        sqlite.prepare(\`
          INSERT INTO knowledge_gaps (id, lead_id, question, context, status)
          VALUES (?, ?, ?, ?, 'pending')
        \`).run(id, realLeadId, question, context);
        return sqlite.prepare('SELECT * FROM knowledge_gaps WHERE id = ?').get(id);
      } catch (e) {}
    }
    return { id, lead_id: realLeadId, question, context, status: 'pending' };
  },

  async resolveGap(id: string, answer: string): Promise<void> {
    const kbId = \`kb-gap-\${id}\`;
    const resolvedAt = new Date().toISOString();

    if (useSupabase && supabase) {
      const res = await runSupabaseQuery((c) => c.from('knowledge_gaps').select('*').eq('id', id).single());
      const gap = res?.data;
      if (gap) {
        await runSupabaseQuery((c) => c.from('knowledge_gaps').update({ status: 'resolved', answer, resolved_at: resolvedAt }).eq('id', id));
        await runSupabaseQuery((c) => c.from('knowledge_base').insert({
          id: kbId,
          title: \`Resolved Gap: \${gap.question.slice(0, 40)}...\`,
          file_type: 'txt',
          content: \`Question: \${gap.question}\\nAnswer: \${answer}\`,
          summary: \`Learned answer for: "\${gap.question}"\`
        }));
        if (gap.lead_id) {
          await runSupabaseQuery((c) => c.from('leads').update({ bot_active: true }).eq('id', gap.lead_id));
        }
      }
    }

    const sqlite = getSqliteDb();
    if (sqlite) {
      try {
        const gap = sqlite.prepare('SELECT * FROM knowledge_gaps WHERE id = ?').get(id) as any;
        if (gap) {
          sqlite.prepare("UPDATE knowledge_gaps SET status = 'resolved', answer = ?, resolved_at = ? WHERE id = ?").run(answer, resolvedAt, id);
          sqlite.prepare(\`
            INSERT INTO knowledge_base (id, title, file_type, content, summary)
            VALUES (?, ?, 'txt', ?, ?)
          \`).run(kbId, \`Resolved Gap: \${gap.question.slice(0, 40)}...\`, \`Question: \${gap.question}\\nAnswer: \${answer}\`, \`Learned answer for: "\${gap.question}"\`);
          if (gap.lead_id) {
            sqlite.prepare('UPDATE leads SET bot_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(gap.lead_id);
          }
        }
      } catch (e) {}
    }
  },

  async deleteGap(id: string): Promise<void> {
    if (useSupabase && supabase) {
      const res = await runSupabaseQuery((c) => c.from('knowledge_gaps').select('lead_id').eq('id', id).maybeSingle());
      const gap = res?.data;
      await runSupabaseQuery((c) => c.from('knowledge_gaps').delete().eq('id', id));
      if (gap && gap.lead_id) {
        await runSupabaseQuery((c) => c.from('leads').update({ bot_active: true }).eq('id', gap.lead_id));
      }
    }

    const sqlite = getSqliteDb();
    if (sqlite) {
      try {
        const gap = sqlite.prepare('SELECT lead_id FROM knowledge_gaps WHERE id = ?').get(id) as any;
        sqlite.prepare('DELETE FROM knowledge_gaps WHERE id = ?').run(id);
        if (gap && gap.lead_id) {
          sqlite.prepare('UPDATE leads SET bot_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(gap.lead_id);
        }
      } catch (e) {}
    }
  },
`;

content = content.replace(
  /localJsonDb\.deleteFlow\(id\);[\s\S]*?\/\/ --- CHAT MESSAGES/g,
  `localJsonDb.deleteFlow(id);\n  },\n${kbAndGapsSection.trim()}\n\n  // --- CHAT MESSAGES`
);

fs.writeFileSync(dbPath, content, 'utf-8');
console.log('✅ Restored knowledge base and gap methods in lib/db.ts');

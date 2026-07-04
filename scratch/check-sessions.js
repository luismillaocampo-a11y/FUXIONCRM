const Database = require('better-sqlite3');
const path = require('path');

async function checkSessions() {
  console.log('Checking whatsapp_sessions in SQLite...');
  try {
    const db = new Database(path.join(__dirname, '../db.sqlite'));
    const rows = db.prepare('SELECT * FROM whatsapp_sessions').all();
    console.log('SQLite whatsapp_sessions:', rows.map(s => {
      let me_id = null;
      try {
        const creds = JSON.parse(s.creds);
        me_id = creds?.me?.id;
      } catch (e) {}
      return {
        id: s.id,
        creds_exists: !!s.creds,
        keys_exists: !!s.keys,
        me_id: me_id,
        updated_at: s.updated_at
      };
    }));
  } catch (e) {
    console.error('SQLite sessions check error:', e);
  }
}

checkSessions();

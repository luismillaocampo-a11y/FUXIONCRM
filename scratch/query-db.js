const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../db.sqlite'));

const leads = db.prepare('SELECT * FROM leads').all();
console.log('--- LEADS ---');
console.log(JSON.stringify(leads, null, 2));

const messages = db.prepare('SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 20').all();
console.log('--- LATEST MESSAGES ---');
console.log(JSON.stringify(messages, null, 2));

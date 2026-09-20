const fs = require('fs');
const path = require('path');
const os = require('os');

const appDataDir = process.env.APPDATA 
  ? path.join(process.env.APPDATA, 'NutraFlow CRM') 
  : path.join(os.homedir(), '.nutraflow-crm');

const appDataJson = path.join(appDataDir, 'app_data.json');

console.log('=== INSPECTING RAG KNOWLEDGE BASE ITEMS ===');

if (!fs.existsSync(appDataJson)) {
  console.log('No app_data.json found.');
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(appDataJson, 'utf-8'));
const kbItems = data.knowledge_base || [];

console.log(`Total KB items found: ${kbItems.length}`);
kbItems.forEach((item, index) => {
  console.log(`[${index + 1}] ID: ${item.id} | Title: "${item.title}" | FileType: ${item.file_type}`);
});

// Check for duplicate titles or contents
const seen = new Map();
const duplicates = [];

kbItems.forEach((item) => {
  const normTitle = (item.title || '').trim().toLowerCase();
  if (seen.has(normTitle)) {
    duplicates.push(item);
  } else {
    seen.set(normTitle, item);
  }
});

if (duplicates.length > 0) {
  console.log(`\n⚠️ Found ${duplicates.length} duplicate items. Cleaning duplicates...`);
  const uniqueItems = Array.from(seen.values());
  data.knowledge_base = uniqueItems;
  fs.writeFileSync(appDataJson, JSON.stringify(data, null, 2), 'utf-8');
  console.log('✅ Deduplicated knowledge_base successfully!');
} else {
  console.log('\n✅ NO duplicates found! All items are unique.');
}

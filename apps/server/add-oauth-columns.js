const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'playlist-lab.db');
const db = new Database(dbPath);

try {
  console.log('Adding expires_at column...');
  db.exec('ALTER TABLE oauth_connections ADD COLUMN expires_at INTEGER');
  console.log('✓ expires_at column added');
} catch (e) {
  if (e.message.includes('duplicate column name')) {
    console.log('✓ expires_at column already exists');
  } else {
    console.error('Error adding expires_at:', e.message);
  }
}

try {
  console.log('Adding refresh_token column...');
  db.exec('ALTER TABLE oauth_connections ADD COLUMN refresh_token TEXT');
  console.log('✓ refresh_token column added');
} catch (e) {
  if (e.message.includes('duplicate column name')) {
    console.log('✓ refresh_token column already exists');
  } else {
    console.error('Error adding refresh_token:', e.message);
  }
}

db.close();
console.log('\nDatabase migration complete!');

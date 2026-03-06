/**
 * Database Usage Example
 * 
 * This file demonstrates how to initialize and use the database.
 * Run with: ts-node apps/server/src/database/example.ts
 */

import { initializeDatabase, verifySchema, getDatabaseStats } from './init';
import path from 'path';

// Example: Initialize database
function exampleInitialization() {
  console.log('=== Database Initialization Example ===\n');

  // Define database path (in-memory for this example)
  const dbPath = path.join(__dirname, '../../../../data/playlist-lab.db');
  
  console.log(`Initializing database at: ${dbPath}`);
  
  // Initialize the database
  const db = initializeDatabase(dbPath);
  
  // Verify schema
  console.log('\nVerifying schema...');
  const isValid = verifySchema(db);
  
  if (isValid) {
    console.log('✓ Schema verification passed');
  } else {
    console.log('✗ Schema verification failed');
    process.exit(1);
  }
  
  // Get statistics
  console.log('\nDatabase statistics:');
  const stats = getDatabaseStats(db);
  for (const [table, count] of Object.entries(stats)) {
    console.log(`  ${table}: ${count} rows`);
  }
  
  // Close database
  db.close();
  console.log('\n✓ Database closed successfully');
}

// Example: Query database
function exampleQueries() {
  console.log('\n=== Database Query Examples ===\n');
  
  const dbPath = ':memory:'; // Use in-memory database for examples
  const db = initializeDatabase(dbPath);
  
  // Example 1: Insert a user
  console.log('Example 1: Insert a user');
  const insertUser = db.prepare(`
    INSERT INTO users (plex_user_id, plex_username, plex_token, created_at, last_login)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const now = Math.floor(Date.now() / 1000);
  const result = insertUser.run('user123', 'testuser', 'encrypted_token', now, now);
  console.log(`  Inserted user with ID: ${result.lastInsertRowid}`);
  
  // Example 2: Query the user
  console.log('\nExample 2: Query the user');
  const getUser = db.prepare('SELECT * FROM users WHERE plex_user_id = ?');
  const user = getUser.get('user123');
  console.log('  User:', user);
  
  // Example 3: Insert user settings
  console.log('\nExample 3: Insert user settings');
  const insertSettings = db.prepare(`
    INSERT INTO user_settings (user_id, country, matching_settings, mix_settings)
    VALUES (?, ?, ?, ?)
  `);
  
  const matchingSettings = JSON.stringify({
    minMatchScore: 0.7,
    stripParentheses: true,
    stripBrackets: true
  });
  
  const mixSettings = JSON.stringify({
    weeklyMix: { topArtists: 10, tracksPerArtist: 5 }
  });
  
  insertSettings.run(result.lastInsertRowid, 'US', matchingSettings, mixSettings);
  console.log('  Settings inserted');
  
  // Example 4: Query with JOIN
  console.log('\nExample 4: Query user with settings');
  const getUserWithSettings = db.prepare(`
    SELECT u.*, s.country, s.matching_settings, s.mix_settings
    FROM users u
    LEFT JOIN user_settings s ON u.id = s.user_id
    WHERE u.plex_user_id = ?
  `);
  
  const userWithSettings = getUserWithSettings.get('user123');
  console.log('  User with settings:', userWithSettings);
  
  // Example 5: Test CASCADE delete
  console.log('\nExample 5: Test CASCADE delete');
  const deleteUser = db.prepare('DELETE FROM users WHERE id = ?');
  deleteUser.run(result.lastInsertRowid);
  
  const settingsAfterDelete = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(result.lastInsertRowid);
  console.log('  Settings after user deletion:', settingsAfterDelete || 'null (correctly deleted)');
  
  db.close();
  console.log('\n✓ Examples completed successfully');
}

// Run examples
if (require.main === module) {
  try {
    exampleInitialization();
    exampleQueries();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

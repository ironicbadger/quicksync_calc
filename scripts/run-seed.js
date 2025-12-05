#!/usr/bin/env node
/**
 * Run seed-architectures.sql against Turso database
 * Usage: node run-seed.js <turso_url> <turso_token>
 */

const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

const url = process.argv[2];
const authToken = process.argv[3];

if (!url || !authToken) {
  console.error('Usage: node run-seed.js <turso_url> <turso_token>');
  process.exit(1);
}

const client = createClient({ url, authToken });

const sqlPath = path.join(__dirname, 'seed-architectures.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

// Split on semicolons, handling multi-line INSERT statements
const statements = [];
let current = '';

for (const line of sql.split('\n')) {
  const trimmed = line.trim();
  // Skip pure comment lines
  if (trimmed.startsWith('--')) continue;
  // Skip empty lines
  if (!trimmed) continue;

  current += ' ' + trimmed;

  // If line ends with semicolon, we have a complete statement
  if (trimmed.endsWith(';')) {
    statements.push(current.trim().slice(0, -1)); // Remove trailing semicolon
    current = '';
  }
}

// Add any remaining statement
if (current.trim()) {
  statements.push(current.trim());
}

(async () => {
  console.log(`Executing ${statements.length} statements...`);
  let success = 0;
  let errors = 0;

  for (const stmt of statements) {
    if (!stmt) continue;
    // Skip comment-only blocks
    if (stmt.split('\n').every(line => line.trim().startsWith('--') || !line.trim())) continue;

    try {
      await client.execute(stmt + ';');
      const preview = stmt.replace(/\n/g, ' ').substring(0, 60);
      console.log(`OK: ${preview}...`);
      success++;
    } catch (e) {
      const preview = stmt.replace(/\n/g, ' ').substring(0, 60);
      console.error(`ERR: ${preview}... - ${e.message}`);
      errors++;
    }
  }

  console.log(`\nDone! ${success} succeeded, ${errors} failed.`);
  process.exit(errors > 0 ? 1 : 0);
})();

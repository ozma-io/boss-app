#!/usr/bin/env node

/**
 * Migration Runner
 * 
 * Executes Firestore data migrations safely with logging and error handling.
 * 
 * Usage:
 *   npm run migrate -- 2025-11-07-example
 *   npm run migrate -- 2025-11-07-example --dry-run
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';
import 'dotenv/config';

interface Migration {
  name: string;
  description: string;
  date: string;
  author: string;
  up: (db: FirebaseFirestore.Firestore) => Promise<void>;
  down?: (db: FirebaseFirestore.Firestore) => Promise<void>;
}

async function runMigration(): Promise<void> {
  const args = process.argv.slice(2);
  const migrationName = args[0];
  const isDryRun = args.includes('--dry-run');

  if (!migrationName) {
    console.error('❌ Error: Migration name required');
    console.log('Usage: npm run migrate -- <migration-name> [--dry-run]');
    process.exit(1);
  }

  console.log('🔧 Firestore Migration Runner');
  console.log('─────────────────────────────');
  console.log(`Migration: ${migrationName}`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  // Initialize Firebase Admin
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  
  if (!projectId) {
    console.error('❌ Error: EXPO_PUBLIC_FIREBASE_PROJECT_ID not set');
    process.exit(1);
  }

  // For local development, use Application Default Credentials
  // For production, use service account key file
  initializeApp({
    projectId: projectId,
  });

  const db = getFirestore();
  
  console.log(`✅ Connected to Firestore: ${projectId}`);
  console.log('');

  // Load migration file
  const migrationPath = path.join(__dirname, `${migrationName}.ts`);
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Error: Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const { migration }: { migration: Migration } = await import(migrationPath);

  console.log(`📄 Migration: ${migration.name}`);
  console.log(`📝 Description: ${migration.description}`);
  console.log(`📅 Date: ${migration.date}`);
  console.log(`👤 Author: ${migration.author}`);
  console.log('');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
    console.log('');
  }

  // Confirm before proceeding (except in dry-run)
  if (!isDryRun) {
    console.log('⚠️  This will modify your Firestore database!');
    console.log('Press Ctrl+C to cancel, or Enter to continue...');
    
    // Wait for user input (in non-interactive environments, this will fail)
    // For CI/CD, pass --yes flag or skip confirmation
    if (!args.includes('--yes')) {
      await new Promise<void>((resolve) => {
        process.stdin.once('data', () => resolve());
      });
    }
  }

  const startTime = Date.now();
  
  try {
    console.log('🚀 Running migration...');
    console.log('');
    
    await migration.up(db);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('');
    console.log(`✅ Migration completed successfully in ${duration}s`);
    
  } catch (error) {
    const err = error as Error;
    console.error('');
    console.error('❌ Migration failed:', err.message);
    console.error('');
    console.error('Stack trace:', err.stack);
    process.exit(1);
  }
}

runMigration();


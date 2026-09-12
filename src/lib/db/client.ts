import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { hashPin } from '../auth/session';
// Vite raw import keeps the schema bundled with the module instead of a runtime fs read,
// which would otherwise be fragile inside a serverless deployment bundle.
import schemaSql from './schema.sql?raw';

const DB_PATH = process.env.DATABASE_PATH ?? join(process.cwd(), 'data', 'milk.db');

let instance: Database.Database | undefined;

function seedUsers(db: Database.Database) {
	const count = db.prepare('SELECT COUNT(*) as n FROM app_users').get() as { n: number };
	if (count.n > 0) return;

	const adminPin = process.env.ADMIN_PIN ?? '1234';
	const workerPin = process.env.WORKER_PIN ?? '5678';
	const insert = db.prepare(
		'INSERT INTO app_users (role, name, pin_hash) VALUES (@role, @name, @pin_hash)',
	);
	insert.run({ role: 'admin', name: 'Family / Admin', pin_hash: hashPin(adminPin) });
	insert.run({ role: 'worker', name: 'Delivery Worker', pin_hash: hashPin(workerPin) });
}

export function getDb(): Database.Database {
	if (instance) return instance;

	mkdirSync(dirname(DB_PATH), { recursive: true });
	const db = new Database(DB_PATH);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	db.exec(schemaSql);
	seedUsers(db);

	instance = db;
	return db;
}

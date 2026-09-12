import { getDb } from '../db/client';
import type { Role } from './session';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface AttemptRow {
	failed_count: number;
	locked_until: number | null;
}

function getRow(role: Role): AttemptRow | undefined {
	return getDb().prepare('SELECT failed_count, locked_until FROM login_attempts WHERE role = ?').get(role) as
		| AttemptRow
		| undefined;
}

export function getLockoutRemainingMs(role: Role): number {
	const row = getRow(role);
	if (!row?.locked_until) return 0;

	const remaining = row.locked_until - Date.now();
	if (remaining <= 0) {
		getDb().prepare('DELETE FROM login_attempts WHERE role = ?').run(role);
		return 0;
	}
	return remaining;
}

export function recordLoginFailure(role: Role): void {
	const row = getRow(role);
	const failedCount = (row?.failed_count ?? 0) + 1;
	const lockedUntil = failedCount >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : (row?.locked_until ?? null);

	getDb()
		.prepare(
			`INSERT INTO login_attempts (role, failed_count, locked_until) VALUES (@role, @failedCount, @lockedUntil)
			 ON CONFLICT(role) DO UPDATE SET failed_count = @failedCount, locked_until = @lockedUntil`,
		)
		.run({ role, failedCount, lockedUntil });
}

export function recordLoginSuccess(role: Role): void {
	getDb().prepare('DELETE FROM login_attempts WHERE role = ?').run(role);
}

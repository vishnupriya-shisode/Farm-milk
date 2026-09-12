import { getDb } from './client';
import type { Role } from '../auth/session';

export interface AppUser {
	id: number;
	role: Role;
	name: string;
	pin_hash: string;
}

export function getUserByRole(role: Role): AppUser | undefined {
	return getDb().prepare('SELECT * FROM app_users WHERE role = ?').get(role) as
		| AppUser
		| undefined;
}

export function updateUserPin(role: Role, pinHash: string): void {
	getDb().prepare('UPDATE app_users SET pin_hash = ? WHERE role = ?').run(pinHash, role);
}

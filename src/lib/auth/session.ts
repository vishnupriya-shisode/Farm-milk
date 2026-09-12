import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'milk_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days — this app is used from a few trusted phones

function loadSecret(): string {
	const secret = process.env.SESSION_SECRET;
	if (secret) return secret;
	if (import.meta.env.PROD) {
		throw new Error('SESSION_SECRET environment variable must be set in production.');
	}
	return 'dev-only-insecure-secret-change-me';
}

const SECRET = loadSecret();

export type Role = 'admin' | 'worker';

export interface SessionPayload {
	role: Role;
	name: string;
	exp: number;
}

export function hashPin(pin: string): string {
	const salt = randomBytes(16).toString('hex');
	const hash = scryptSync(pin, salt, 64).toString('hex');
	return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
	const [salt, hash] = stored.split(':');
	if (!salt || !hash) return false;
	const candidate = scryptSync(pin, salt, 64);
	const expected = Buffer.from(hash, 'hex');
	if (candidate.length !== expected.length) return false;
	return timingSafeEqual(candidate, expected);
}

function sign(value: string): string {
	return createHmac('sha256', SECRET).update(value).digest('hex');
}

export function createSessionToken(payload: Omit<SessionPayload, 'exp'>): string {
	const full: SessionPayload = {
		...payload,
		exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
	};
	const body = Buffer.from(JSON.stringify(full)).toString('base64url');
	return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
	if (!token) return null;
	const [body, signature] = token.split('.');
	if (!body || !signature) return null;

	const expected = Buffer.from(sign(body), 'hex');
	const actual = Buffer.from(signature, 'hex');
	if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

	try {
		const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload;
		if (payload.exp < Date.now()) return null;
		return payload;
	} catch {
		return null;
	}
}

export const sessionCookieOptions = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: import.meta.env.PROD,
	maxAge: SESSION_MAX_AGE_SECONDS,
};

import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, verifySessionToken, type Role } from './lib/auth/session';
import { getLang, makeT, type Lang, type TFunction } from './lib/i18n';

export interface SessionUser {
	role: Role;
	name: string;
}

declare global {
	namespace App {
		interface Locals {
			user?: SessionUser;
			lang: Lang;
			t: TFunction;
		}
	}
}

const PROTECTED_PREFIXES: { prefix: string; roles: Role[] }[] = [
	{ prefix: '/admin', roles: ['admin'] },
	{ prefix: '/worker', roles: ['worker', 'admin'] },
];

export const onRequest = defineMiddleware((context, next) => {
	const lang = getLang(context.cookies);
	context.locals.lang = lang;
	context.locals.t = makeT(lang);

	const token = context.cookies.get(SESSION_COOKIE)?.value;
	const session = verifySessionToken(token);
	if (session) {
		context.locals.user = { role: session.role, name: session.name };
	}

	const path = context.url.pathname;
	const guard = PROTECTED_PREFIXES.find(({ prefix }) => path.startsWith(prefix));
	if (guard && (!context.locals.user || !guard.roles.includes(context.locals.user.role))) {
		return context.redirect(`/login?next=${encodeURIComponent(path)}`);
	}

	return next();
});

import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import type { ActionAPIContext } from 'astro:actions';
import { getUserByRole, updateUserPin } from '../lib/db/users';
import {
	createSessionToken,
	hashPin,
	SESSION_COOKIE,
	sessionCookieOptions,
	verifyPin,
	type Role,
} from '../lib/auth/session';
import { createCustomer, createQuantityOverride, getCustomer, updateCustomer } from '../lib/db/customers';
import { markDelivery } from '../lib/db/deliveries';
import { recordPayment } from '../lib/db/payments';
import type { SessionUser } from '../middleware';

function requireRole(context: ActionAPIContext, roles: Role[]): SessionUser {
	const user = (context.locals as { user?: SessionUser }).user;
	if (!user || !roles.includes(user.role)) {
		throw new ActionError({ code: 'UNAUTHORIZED', message: 'Please log in again.' });
	}
	return user;
}

const customerFields = {
	name: z.string().min(1),
	phone: z.string().optional(),
	address: z.string().optional(),
	default_qty_morning: z.coerce.number().min(0),
	default_qty_evening: z.coerce.number().min(0),
	rate_per_liter: z.coerce.number().min(0),
	status: z.enum(['active', 'paused']).optional(),
	notes: z.string().optional(),
};

export const server = {
	auth: {
		login: defineAction({
			accept: 'form',
			input: z.object({
				role: z.enum(['admin', 'worker']),
				pin: z.string().min(1),
				next: z.string().optional(),
			}),
			handler: async (input, context) => {
				const user = getUserByRole(input.role);
				if (!user || !verifyPin(input.pin, user.pin_hash)) {
					throw new ActionError({ code: 'UNAUTHORIZED', message: 'Wrong PIN. Please try again.' });
				}
				const token = createSessionToken({ role: user.role, name: user.name });
				context.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
				return { role: user.role, next: input.next ?? null };
			},
		}),
	},
	users: {
		setPin: defineAction({
			accept: 'form',
			input: z.object({
				target_role: z.enum(['admin', 'worker']),
				current_pin: z.string().min(1),
				new_pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits'),
			}),
			handler: async (input, context) => {
				requireRole(context, ['admin']);

				const admin = getUserByRole('admin');
				if (!admin || !verifyPin(input.current_pin, admin.pin_hash)) {
					throw new ActionError({ code: 'UNAUTHORIZED', message: 'Your current PIN is incorrect.' });
				}

				updateUserPin(input.target_role, hashPin(input.new_pin));
				return { target_role: input.target_role };
			},
		}),
	},
	customers: {
		create: defineAction({
			accept: 'form',
			input: z.object(customerFields),
			handler: async (input, context) => {
				requireRole(context, ['admin']);
				const id = createCustomer(input);
				return { id };
			},
		}),
		update: defineAction({
			accept: 'form',
			input: z.object({ id: z.coerce.number(), ...customerFields }),
			handler: async (input, context) => {
				requireRole(context, ['admin']);
				const { id, ...rest } = input;
				updateCustomer(id, rest);
				return { id };
			},
		}),
		addOverride: defineAction({
			accept: 'form',
			input: z.object({
				customer_id: z.coerce.number(),
				shift: z.enum(['morning', 'evening']),
				start_date: z.string().min(1),
				end_date: z.string().min(1),
				quantity: z.coerce.number().min(0),
				reason: z.string().optional(),
			}),
			handler: async (input, context) => {
				requireRole(context, ['admin']);
				createQuantityOverride(input);
				return { success: true };
			},
		}),
	},
	deliveries: {
		mark: defineAction({
			accept: 'form',
			input: z.object({
				customer_id: z.coerce.number(),
				date: z.string().min(1),
				shift: z.enum(['morning', 'evening']),
				status: z.enum(['delivered', 'skipped']),
				actual_quantity: z.coerce.number().min(0).default(0),
				extra_quantity: z.coerce.number().min(0).default(0),
			}),
			handler: async (input, context) => {
				const user = requireRole(context, ['admin', 'worker']);
				const customer = getCustomer(input.customer_id);
				if (!customer) throw new ActionError({ code: 'NOT_FOUND', message: 'Customer not found.' });

				markDelivery({
					...input,
					rate_snapshot: customer.rate_per_liter,
					recorded_by: user.name,
				});
				return { success: true };
			},
		}),
	},
	payments: {
		record: defineAction({
			accept: 'form',
			input: z.object({
				customer_id: z.coerce.number(),
				amount: z.coerce.number().positive(),
				payment_date: z.string().min(1),
				method: z.enum(['cash', 'phonepe', 'other']),
				note: z.string().optional(),
			}),
			handler: async (input, context) => {
				const user = requireRole(context, ['admin']);
				recordPayment({ ...input, recorded_by: user.name });
				return { success: true };
			},
		}),
	},
};

import { getDb } from './client';

export interface Customer {
	id: number;
	name: string;
	phone: string | null;
	address: string | null;
	default_qty_morning: number;
	rate_per_liter: number;
	status: 'active' | 'paused';
	notes: string | null;
	created_at: string;
}

export interface CustomerInput {
	name: string;
	phone?: string;
	address?: string;
	default_qty_morning: number;
	rate_per_liter: number;
	status?: 'active' | 'paused';
	notes?: string;
}

export interface QuantityOverride {
	id: number;
	customer_id: number;
	start_date: string;
	end_date: string;
	quantity: number;
	reason: string | null;
}

export function listCustomers(opts: { activeOnly?: boolean } = {}): Customer[] {
	const db = getDb();
	if (opts.activeOnly) {
		return db
			.prepare("SELECT * FROM customers WHERE status = 'active' ORDER BY name COLLATE NOCASE")
			.all() as Customer[];
	}
	return db.prepare('SELECT * FROM customers ORDER BY name COLLATE NOCASE').all() as Customer[];
}

export function getCustomer(id: number): Customer | undefined {
	return getDb().prepare('SELECT * FROM customers WHERE id = ?').get(id) as Customer | undefined;
}

export function createCustomer(input: CustomerInput): number {
	const db = getDb();
	const result = db
		.prepare(
			`INSERT INTO customers (name, phone, address, default_qty_morning, rate_per_liter, status, notes)
			 VALUES (@name, @phone, @address, @default_qty_morning, @rate_per_liter, @status, @notes)`,
		)
		.run({
			name: input.name,
			phone: input.phone ?? null,
			address: input.address ?? null,
			default_qty_morning: input.default_qty_morning,
			rate_per_liter: input.rate_per_liter,
			status: input.status ?? 'active',
			notes: input.notes ?? null,
		});
	return Number(result.lastInsertRowid);
}

export function updateCustomer(id: number, input: CustomerInput): void {
	const db = getDb();
	db.prepare(
		`UPDATE customers SET name = @name, phone = @phone, address = @address,
		 default_qty_morning = @default_qty_morning,
		 rate_per_liter = @rate_per_liter, status = @status, notes = @notes
		 WHERE id = @id`,
	).run({
		id,
		name: input.name,
		phone: input.phone ?? null,
		address: input.address ?? null,
		default_qty_morning: input.default_qty_morning,
		rate_per_liter: input.rate_per_liter,
		status: input.status ?? 'active',
		notes: input.notes ?? null,
	});
}

export function createQuantityOverride(input: {
	customer_id: number;
	start_date: string;
	end_date: string;
	quantity: number;
	reason?: string;
}): void {
	getDb()
		.prepare(
			`INSERT INTO quantity_overrides (customer_id, start_date, end_date, quantity, reason)
			 VALUES (@customer_id, @start_date, @end_date, @quantity, @reason)`,
		)
		.run({ ...input, reason: input.reason ?? null });
}

export function listOverridesForCustomer(customerId: number): QuantityOverride[] {
	return getDb()
		.prepare(
			'SELECT * FROM quantity_overrides WHERE customer_id = ? ORDER BY start_date DESC',
		)
		.all(customerId) as QuantityOverride[];
}

/** Planned quantity for a customer/date, honoring any active temporary override. */
export function getPlannedQuantity(customer: Customer, date: string): number {
	const override = getDb()
		.prepare(
			`SELECT quantity FROM quantity_overrides
			 WHERE customer_id = ? AND start_date <= ? AND end_date >= ?
			 ORDER BY id DESC LIMIT 1`,
		)
		.get(customer.id, date, date) as { quantity: number } | undefined;

	if (override) return override.quantity;
	return customer.default_qty_morning;
}

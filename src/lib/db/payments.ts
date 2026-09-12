import { getDb } from './client';

export type PaymentMethod = 'cash' | 'phonepe' | 'other';

export interface Payment {
	id: number;
	customer_id: number;
	amount: number;
	payment_date: string;
	method: PaymentMethod;
	note: string | null;
	recorded_by: string | null;
}

export function recordPayment(input: {
	customer_id: number;
	amount: number;
	payment_date: string;
	method: PaymentMethod;
	note?: string;
	recorded_by: string;
}): void {
	getDb()
		.prepare(
			`INSERT INTO payments (customer_id, amount, payment_date, method, note, recorded_by)
			 VALUES (@customer_id, @amount, @payment_date, @method, @note, @recorded_by)`,
		)
		.run({ ...input, note: input.note ?? null });
}

export function listPaymentsForCustomer(customerId: number, limit = 30): Payment[] {
	return getDb()
		.prepare('SELECT * FROM payments WHERE customer_id = ? ORDER BY payment_date DESC LIMIT ?')
		.all(customerId, limit) as Payment[];
}

export function listRecentPayments(limit = 20) {
	return getDb()
		.prepare(
			`SELECT payments.*, customers.name AS customer_name
			 FROM payments JOIN customers ON customers.id = payments.customer_id
			 ORDER BY payment_date DESC, payments.id DESC LIMIT ?`,
		)
		.all(limit) as (Payment & { customer_name: string })[];
}

/** Pending balance = lifetime delivered amount - lifetime payments, per customer. */
export function listPendingBalances(): { customer_id: number; name: string; pending: number }[] {
	return getDb()
		.prepare(
			`SELECT * FROM (
				SELECT c.id AS customer_id, c.name,
					COALESCE((SELECT SUM(amount) FROM delivery_records d WHERE d.customer_id = c.id AND d.status = 'delivered'), 0)
					- COALESCE((SELECT SUM(amount) FROM payments p WHERE p.customer_id = c.id), 0) AS pending
				FROM customers c
				WHERE c.status = 'active'
			 ) WHERE pending > 0.01
			 ORDER BY pending DESC`,
		)
		.all() as { customer_id: number; name: string; pending: number }[];
}

export function getPendingBalance(customerId: number): number {
	const db = getDb();
	const delivered = db
		.prepare(
			"SELECT COALESCE(SUM(amount), 0) AS total FROM delivery_records WHERE customer_id = ? AND status = 'delivered'",
		)
		.get(customerId) as { total: number };
	const paid = db
		.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE customer_id = ?')
		.get(customerId) as { total: number };
	return delivered.total - paid.total;
}

export function getTotalPendingAcrossCustomers(): number {
	const db = getDb();
	const delivered = db
		.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM delivery_records WHERE status = 'delivered'")
		.get() as { total: number };
	const paid = db.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM payments').get() as {
		total: number;
	};
	return delivered.total - paid.total;
}

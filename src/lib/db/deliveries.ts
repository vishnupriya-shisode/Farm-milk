import { getDb } from './client';
import { getPlannedQuantity, listCustomers, type Customer } from './customers';

export type Shift = 'morning' | 'evening';

export interface DeliveryRecord {
	id: number;
	customer_id: number;
	date: string;
	shift: Shift;
	status: 'delivered' | 'skipped';
	actual_quantity: number;
	extra_quantity: number;
	rate_snapshot: number;
	amount: number;
	recorded_by: string | null;
}

export interface DayEntry {
	customer: Customer;
	shift: Shift;
	plannedQuantity: number;
	record: DeliveryRecord | null;
}

/** Everything a given calendar date needs: active customers x shifts they actually take. */
export function getDayView(date: string): DayEntry[] {
	const db = getDb();
	const customers = listCustomers({ activeOnly: true });
	const records = db
		.prepare('SELECT * FROM delivery_records WHERE date = ?')
		.all(date) as DeliveryRecord[];
	const recordFor = (customerId: number, shift: Shift) =>
		records.find((r) => r.customer_id === customerId && r.shift === shift) ?? null;

	const entries: DayEntry[] = [];
	for (const customer of customers) {
		for (const shift of ['morning', 'evening'] as Shift[]) {
			const plannedQuantity = getPlannedQuantity(customer, date, shift);
			const record = recordFor(customer.id, shift);
			if (plannedQuantity <= 0 && !record) continue; // customer doesn't take this shift
			entries.push({ customer, shift, plannedQuantity, record });
		}
	}
	return entries;
}

export function markDelivery(input: {
	customer_id: number;
	date: string;
	shift: Shift;
	status: 'delivered' | 'skipped';
	actual_quantity: number;
	extra_quantity: number;
	rate_snapshot: number;
	recorded_by: string;
}): void {
	const amount =
		input.status === 'delivered'
			? (input.actual_quantity + input.extra_quantity) * input.rate_snapshot
			: 0;

	getDb()
		.prepare(
			`INSERT INTO delivery_records
				(customer_id, date, shift, status, actual_quantity, extra_quantity, rate_snapshot, amount, recorded_by, updated_at)
			 VALUES
				(@customer_id, @date, @shift, @status, @actual_quantity, @extra_quantity, @rate_snapshot, @amount, @recorded_by, datetime('now'))
			 ON CONFLICT(customer_id, date, shift) DO UPDATE SET
				status = excluded.status,
				actual_quantity = excluded.actual_quantity,
				extra_quantity = excluded.extra_quantity,
				rate_snapshot = excluded.rate_snapshot,
				amount = excluded.amount,
				recorded_by = excluded.recorded_by,
				updated_at = datetime('now')`,
		)
		.run({ ...input, amount });
}

export function listRecordsForCustomer(customerId: number, limit = 30): DeliveryRecord[] {
	return getDb()
		.prepare(
			'SELECT * FROM delivery_records WHERE customer_id = ? ORDER BY date DESC, shift ASC LIMIT ?',
		)
		.all(customerId, limit) as DeliveryRecord[];
}

export function listRecordsForCustomerInMonth(customerId: number, yearMonth: string): DeliveryRecord[] {
	return getDb()
		.prepare(
			"SELECT * FROM delivery_records WHERE customer_id = ? AND date LIKE ? ORDER BY date ASC, shift ASC",
		)
		.all(customerId, `${yearMonth}%`) as DeliveryRecord[];
}

export function getTodaySummary(date: string) {
	const db = getDb();
	const row = db
		.prepare(
			`SELECT
				COALESCE(SUM(CASE WHEN status = 'delivered' THEN actual_quantity + extra_quantity ELSE 0 END), 0) AS totalLiters,
				COALESCE(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END), 0) AS deliveredCount,
				COALESCE(SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END), 0) AS skippedCount,
				COALESCE(SUM(CASE WHEN status = 'delivered' THEN extra_quantity ELSE 0 END), 0) AS extraLiters
			 FROM delivery_records WHERE date = ?`,
		)
		.get(date) as {
		totalLiters: number;
		deliveredCount: number;
		skippedCount: number;
		extraLiters: number;
	};
	return row;
}

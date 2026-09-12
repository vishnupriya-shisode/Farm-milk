import { getDb } from './client';
import { getCustomer } from './customers';
import { listRecordsForCustomerInMonth } from './deliveries';
import { getPendingBalance } from './payments';

/** yearMonth like "2026-09" */
export function getMonthlyStatement(customerId: number, yearMonth: string) {
	const customer = getCustomer(customerId);
	const records = listRecordsForCustomerInMonth(customerId, yearMonth);
	const totalLiters = records
		.filter((r) => r.status === 'delivered')
		.reduce((sum, r) => sum + r.actual_quantity + r.extra_quantity, 0);
	const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);
	const paidInMonth = getDb()
		.prepare(
			"SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE customer_id = ? AND payment_date LIKE ?",
		)
		.get(customerId, `${yearMonth}%`) as { total: number };

	return {
		customer,
		records,
		totalLiters,
		totalAmount,
		paidInMonth: paidInMonth.total,
		pendingOverall: customer ? getPendingBalance(customerId) : 0,
	};
}

export function getBillingOverview(yearMonth: string) {
	const db = getDb();
	const customers = db
		.prepare("SELECT id, name FROM customers WHERE status = 'active' ORDER BY name COLLATE NOCASE")
		.all() as { id: number; name: string }[];

	return customers.map((customer) => {
		const monthRow = db
			.prepare(
				`SELECT
					COALESCE(SUM(CASE WHEN status = 'delivered' THEN actual_quantity + extra_quantity ELSE 0 END), 0) AS totalLiters,
					COALESCE(SUM(amount), 0) AS totalAmount
				 FROM delivery_records WHERE customer_id = ? AND date LIKE ?`,
			)
			.get(customer.id, `${yearMonth}%`) as { totalLiters: number; totalAmount: number };
		const paidInMonth = db
			.prepare(
				"SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE customer_id = ? AND payment_date LIKE ?",
			)
			.get(customer.id, `${yearMonth}%`) as { total: number };

		return {
			customerId: customer.id,
			name: customer.name,
			totalLiters: monthRow.totalLiters,
			totalAmount: monthRow.totalAmount,
			paidInMonth: paidInMonth.total,
			pendingOverall: getPendingBalance(customer.id),
		};
	});
}

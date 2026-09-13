CREATE TABLE IF NOT EXISTS app_users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	role TEXT NOT NULL UNIQUE CHECK (role IN ('admin', 'worker')),
	name TEXT NOT NULL,
	pin_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
	role TEXT PRIMARY KEY CHECK (role IN ('admin', 'worker')),
	failed_count INTEGER NOT NULL DEFAULT 0,
	locked_until INTEGER
);

CREATE TABLE IF NOT EXISTS customers (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	phone TEXT,
	address TEXT,
	default_qty_morning REAL NOT NULL DEFAULT 0,
	rate_per_liter REAL NOT NULL DEFAULT 60,
	status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
	notes TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quantity_overrides (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
	start_date TEXT NOT NULL,
	end_date TEXT NOT NULL,
	quantity REAL NOT NULL,
	reason TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_overrides_customer_dates
	ON quantity_overrides(customer_id, start_date, end_date);

CREATE TABLE IF NOT EXISTS delivery_records (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
	date TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('delivered', 'skipped')),
	actual_quantity REAL NOT NULL DEFAULT 0,
	extra_quantity REAL NOT NULL DEFAULT 0,
	rate_snapshot REAL NOT NULL DEFAULT 0,
	amount REAL NOT NULL DEFAULT 0,
	recorded_by TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now')),
	UNIQUE(customer_id, date)
);

CREATE INDEX IF NOT EXISTS idx_delivery_records_date ON delivery_records(date);
CREATE INDEX IF NOT EXISTS idx_delivery_records_customer ON delivery_records(customer_id, date);

CREATE TABLE IF NOT EXISTS payments (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
	amount REAL NOT NULL,
	payment_date TEXT NOT NULL,
	method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'phonepe', 'other')),
	note TEXT,
	recorded_by TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id, payment_date);

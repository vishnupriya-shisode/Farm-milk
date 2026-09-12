import { defineConfig, devices } from '@playwright/test';

const PORT = 4322;

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: false,
	workers: 1,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: 'retain-on-failure',
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		// --ignore-lock (plus ASTRO_DEV_BACKGROUND=1 to suppress the CLI's own
		// agent auto-background detection) lets this run alongside the project's
		// persistent `astro dev --background` server on 4321 without conflicting
		// over its singleton lock file.
		command: `rm -f data/test-e2e.db* && astro dev --port ${PORT} --ignore-lock`,
		url: `http://localhost:${PORT}`,
		reuseExistingServer: false,
		timeout: 30_000,
		env: {
			ASTRO_DEV_BACKGROUND: '1',
			DATABASE_PATH: 'data/test-e2e.db',
			ADMIN_PIN: '1234',
			WORKER_PIN: '5678',
		},
	},
});

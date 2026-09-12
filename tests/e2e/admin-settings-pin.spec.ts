import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, role: 'admin' | 'worker', pin: string) {
	await page.goto('/login');
	await page.click(`label:has(input[value="${role}"])`);
	await page.fill('#pin', pin);
	await page.click('button[type=submit]');
}

async function logout(page: Page) {
	await page.click('button:has-text("Logout")');
	await page.waitForURL('/');
}

test.describe.serial('admin settings — PIN management', () => {
	test('admin can view the settings page with both PIN forms', async ({ page }) => {
		await login(page, 'admin', '1234');
		await page.waitForURL('/admin');

		await page.goto('/admin/settings');
		await expect(page.getByText('Login PINs')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Update Worker PIN' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Update Admin PIN' })).toBeVisible();
	});

	test('rejects a worker PIN change when the current admin PIN is wrong', async ({ page }) => {
		await login(page, 'admin', '1234');
		await page.waitForURL('/admin');
		await page.goto('/admin/settings');

		const workerForm = page.locator('form:has(input[name="target_role"][value="worker"])');
		await workerForm.locator('#current_pin_worker').fill('0000');
		await workerForm.locator('#new_pin_worker').fill('4321');
		await workerForm.getByRole('button', { name: 'Update Worker PIN' }).click();

		await expect(page.getByText('Your current PIN is incorrect.')).toBeVisible();
	});

	test('admin can change the worker PIN and the worker can log in with it', async ({ page }) => {
		await login(page, 'admin', '1234');
		await page.waitForURL('/admin');
		await page.goto('/admin/settings');

		const workerForm = page.locator('form:has(input[name="target_role"][value="worker"])');
		await workerForm.locator('#current_pin_worker').fill('1234');
		await workerForm.locator('#new_pin_worker').fill('4321');
		await workerForm.getByRole('button', { name: 'Update Worker PIN' }).click();

		await expect(page.getByText('Worker PIN updated.')).toBeVisible();

		await logout(page);

		await login(page, 'worker', '5678');
		await expect(page).not.toHaveURL(/\/worker$/);

		await login(page, 'worker', '4321');
		await page.waitForURL('/worker');
	});

	test('admin can change their own PIN and log in with it afterwards', async ({ page }) => {
		await login(page, 'admin', '1234');
		await page.waitForURL('/admin');
		await page.goto('/admin/settings');

		const adminForm = page.locator('form:has(input[name="target_role"][value="admin"])');
		await adminForm.locator('#current_pin_admin').fill('1234');
		await adminForm.locator('#new_pin_admin').fill('9999');
		await adminForm.getByRole('button', { name: 'Update Admin PIN' }).click();

		await expect(page.getByText('Admin PIN updated.')).toBeVisible();

		await logout(page);

		await login(page, 'admin', '9999');
		await page.waitForURL('/admin');
	});
});

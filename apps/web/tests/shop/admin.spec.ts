import { randomBytes, randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page) {
  const password = process.env.ZESTORA_TEST_ADMIN_PASSWORD;
  if (!password) throw new Error('Browser admin fixture is missing.');
  await page.goto('/admin');
  await expect(page.getByText('An administrator account is required.')).toBeVisible();
  await page.getByRole('link', { name: 'Sign in' }).click();
  await page.getByLabel('Email').fill('browser-owner@zestora.example');
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Admin dashboard' })).toBeVisible();
}

test('owner creates catalogue data and changes public shop branding', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Catalogue' }).click();
  const category = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Categories', exact: true }) });
  await category.getByLabel('Identifier').fill('browser-samples');
  await category.locator('input[name="nameEn"]').fill('Browser Samples');
  await category.locator('input[name="nameSi"]').fill('බ්‍රවුසර ආදර්ශ');
  await category.getByRole('button', { name: 'Save changes' }).click();
  await expect(category.getByRole('status')).toHaveText('Saved.');
  await expect(category.getByRole('option', { name: 'Browser Samples' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Business settings' }).click();
  await page.getByLabel('Business name').fill('Zestora Test Bar');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved.');
  await expect(page.getByRole('banner').getByRole('link', { name: 'Zestora Test Bar' })).toBeVisible();
});

test('owner locates an order and records its cash payment', async ({ page }) => {
  const created = await page.request.post('/api/orders', { data: {
    checkoutKey: randomUUID(), guestKey: randomBytes(32).toString('base64url'),
    items: [{ productSlug: 'golden-mango', sizeId: 'regular', addOnIds: [], quantity: 1 }],
    customer: { name: 'Admin Report Buyer', email: 'admin-test@zestora.example', phone: '+94 71 000 0000' },
    fulfillment: { type: 'pickup' }, expectedTotal: 690,
  } });
  expect(created.status()).toBe(201);
  const { order } = await created.json();
  await signIn(page);
  await page.getByRole('navigation', { name: 'Admin dashboard' }).getByRole('button', { name: 'Orders' }).click();
  await page.getByLabel('Search reference or customer').fill(order.reference);
  await page.getByRole('button', { name: new RegExp(order.reference) }).click();
  await page.getByRole('button', { name: 'Confirmed', exact: true }).click();
  await expect(page.locator('#admin-print')).toContainText('Confirmed');
  await page.getByRole('button', { name: 'Confirm cash payment' }).click();
  await expect(page.locator('#admin-print')).toContainText('Paid');
  await page.evaluate(() => { window.print = () => document.documentElement.setAttribute('data-order-print', 'true'); });
  await page.getByRole('button', { name: 'Print order' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-order-print', 'true');
  await page.getByRole('button', { name: 'Overview' }).click();
  await expect(page.getByText('Revenue', { exact: true }).locator('..')).toContainText(/LKR\s*690/);
});

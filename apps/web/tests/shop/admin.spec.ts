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

test('customer sees verified suggestions and owner can save an AI fallback report and draft', async ({ page }) => {
  await page.goto('/assistant');
  await page.getByLabel('Your question').fill('Which drinks have mango?');
  await page.getByRole('button', { name: 'Ask the assistant' }).click();
  await expect(page.getByRole('link', { name: 'Golden Mango' })).toBeVisible();
  await expect(page.getByText('Based on shop records')).toBeVisible();
  await page.goto('/recommendations');
  await page.getByLabel('Flavour preference').fill('Mango');
  await page.getByLabel('Exclude ingredients (comma-separated)').fill('yoghurt');
  await page.getByRole('button', { name: 'Find suggestions' }).click();
  await expect(page.getByText('Based on shop records')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Berry Bliss' })).toHaveCount(0);

  await signIn(page);
  await page.getByRole('button', { name: 'Insights' }).click();
  await page.getByRole('button', { name: 'Generate report' }).click();
  await expect(page.getByLabel('Saved report')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AI usage over the last 30 days' })).toBeVisible();
  await expect(page.getByText('Model provider is unconfigured.')).toBeVisible();
  await page.getByRole('button', { name: 'Generate draft' }).click();
  await expect(page.getByText('Draft · Template draft')).toBeVisible();
  await page.getByRole('button', { name: 'Approve draft' }).click();
  await expect(page.getByText('Approved · Template draft')).toBeVisible();
  await page.getByRole('button', { name: 'Automation' }).click();
  await page.getByLabel('Workflow status').selectOption('failed');
  await expect(page.getByText('Scheduled reports are unconfigured.')).toBeVisible();
});

test('owner previews and publishes a bilingual policy used by the shop and assistant', async ({ page }) => {
  const english = 'Demo refunds for unopened bottles are reviewed at the pickup counter.';
  const sinhala = 'විවෘත නොකළ බෝතල් සඳහා මුදල් ආපසු ලබා ගැනීම කවුන්ටරයෙන් සිදු කෙරේ.';
  await page.goto('/refunds');
  await expect(page.getByText('Policy preview')).toBeVisible();
  await signIn(page);
  await page.getByRole('button', { name: 'Policies', exact: true }).click();
  await page.getByLabel('Policy to edit').selectOption('refunds');
  await page.getByLabel('English policy text').fill(english);
  await page.getByLabel('Sinhala policy text').fill(sinhala);
  const preview = page.getByRole('group').filter({ hasText: 'Draft preview' });
  await preview.getByText('Draft preview', { exact: true }).click();
  await expect(preview.getByText(english, { exact: true })).toBeVisible();
  await expect(preview.getByText(sinhala, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish saved draft' })).toBeDisabled();
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Draft saved.')).toBeVisible();
  expect(await (await page.request.get('/api/shop/policies/refunds')).json()).toEqual({ item: null });
  await page.getByRole('button', { name: 'Publish saved draft' }).click();
  await expect(page.getByText('Policy published.')).toBeVisible();
  await page.getByRole('link', { name: 'View public policy' }).click();
  await expect(page).toHaveURL(/\/refunds$/);
  await expect(page.getByRole('heading', { name: 'Refund policy', exact: true, level: 1 })).toBeVisible();
  await expect(page.getByText(english, { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText('Policy preview')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Language' }).first().selectOption('si');
  await expect(page.getByText(sinhala, { exact: true })).toBeVisible();
  await page.getByRole('combobox').first().selectOption('en');

  await page.goto('/assistant');
  await page.getByLabel('Your question').fill('What is the refund policy for unopened bottles?');
  await page.getByRole('button', { name: 'Ask the assistant' }).click();
  await expect(page.getByText('Published shop policy')).toBeVisible();
  await expect(page.getByText(english, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View details' })).toHaveAttribute('href', '/refunds');
});

import { randomBytes, randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

async function startCheckout(page: Page, size = 'regular', qty = '1') {
  await page.goto('/menu/golden-mango');
  await page.getByLabel('Size', { exact: true }).selectOption(size);
  await page.getByLabel('Quantity', { exact: true }).selectOption(qty);
  if (size === 'large') await page.getByRole('checkbox', { name: /Chia seeds/ }).check();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('main').getByRole('link', { name: 'Cart' }).click();
  await expect(page.getByRole('heading', { name: 'Cart', level: 1 })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Quantity: Golden Mango')).toHaveValue(qty);
  await page.getByRole('link', { name: 'Checkout' }).click();
}

test('guest can place a delivery order and track it with the separate key', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startCheckout(page, 'large', '2');
  await page.getByLabel('Your name').fill('Guest Example');
  await page.getByLabel('Email').fill('guest-order@zestora.example');
  await page.getByLabel('Phone').fill('+94 71 000 0000');
  await page.getByLabel(/Fulfilment/).selectOption('delivery');
  await page.getByLabel(/Delivery zone/).selectOption('colombo');
  await page.getByLabel('Street address').fill('Example home, Colombo');
  await page.getByLabel(/Coupon code/).fill('fresh10');
  await page.getByRole('button', { name: 'Review total' }).click();
  await expect(page.getByText(/LKR\s*1,896/)).toBeVisible();
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByRole('heading', { name: 'Order confirmation' })).toBeVisible();
  const key = await page.getByLabel('Guest tracking key').inputValue();
  expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
  await page.getByRole('main').getByRole('link', { name: 'Track order' }).click();
  await page.getByLabel('Guest tracking key').fill(randomBytes(32).toString('base64url'));
  await page.getByRole('button', { name: 'Find order' }).click();
  await expect(page.getByRole('alert')).toContainText('No order matches');
  await page.getByLabel('Guest tracking key').fill(key);
  await page.getByRole('button', { name: 'Find order' }).click();
  await expect(page.getByText('Cash on delivery')).toBeVisible();
  await expect(page.getByText('Example home, Colombo')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('a customer saves an address, places a pickup order, and reorders from history', async ({ page }) => {
  const email = 'account-' + randomUUID() + '@zestora.example';
  await page.goto('/account');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByLabel('Your name').fill('Account Buyer');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(randomBytes(18).toString('base64url'));
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await page.getByLabel('Address label').fill('Home');
  await page.getByLabel('Street address').fill('Example residence, Colombo');
  await page.getByRole('button', { name: 'Save address' }).click();
  await expect(page.getByText('Example residence, Colombo')).toBeVisible();

  await startCheckout(page);
  await expect(page.getByLabel('Email')).toHaveValue(email);
  await page.getByLabel('Phone').fill('+94 71 000 0000');
  await page.getByRole('button', { name: 'Review total' }).click();
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByText('Cash on pickup')).toBeVisible();
  await expect(page.getByLabel('Guest tracking key')).toHaveCount(0);

  await page.getByRole('link', { name: 'Account' }).click();
  await expect(page.getByRole('heading', { name: 'Order history' })).toBeVisible();
  await page.getByRole('button', { name: 'Reorder' }).click();
  await expect(page.getByLabel('Quantity: Golden Mango')).toHaveValue('1');
});

test('checkout can simulate a PayHere decline and success without a real charge', async ({ page }) => {
  await startCheckout(page);
  await page.getByLabel('Your name').fill('Simulator Buyer');
  await page.getByLabel('Email').fill('simulator@zestora.example');
  await page.getByLabel('Phone').fill('+94 71 000 0000');
  await page.getByLabel(/Payment method/).selectOption('payhere');
  await expect(page.getByText('Development simulator. No real charge.')).toBeVisible();
  await page.getByLabel('Billing address').fill('Example billing address');
  await page.getByLabel('Billing city').fill('Colombo');
  await page.getByRole('button', { name: 'Review total' }).click();
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByRole('heading', { name: 'Order confirmation' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to PayHere' }).click();
  await page.getByRole('button', { name: 'Simulate failure' }).click();
  await expect(page.getByText('Simulated payment status: Failed')).toBeVisible();
  await page.getByRole('button', { name: 'Simulate success' }).click();
  await expect(page.getByText('Paid', { exact: true })).toBeVisible();
  await expect(page.getByText('Development simulator. No real charge.')).toBeVisible();
});

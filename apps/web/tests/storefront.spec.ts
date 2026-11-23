import { expect, test } from '@playwright/test';

test('desktop home presents the catalogue with working imagery and links', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Freshness in\s*Every Sip\./);
  const hero = page.getByRole('img', { name: /mango and berry drinks/i });
  await expect(hero).toBeVisible();
  await expect.poll(() => hero.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(1000);
  await page.getByRole('link', { name: 'Smoothies', exact: true }).click();
  await expect(page).toHaveURL(/\/menu\?category=smoothies$/);
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Berry Bliss' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('catalogue filters, sorts, and restores its state from the URL', async ({ page }) => {
  await page.goto('/menu');
  await expect(page.getByRole('article')).toHaveCount(6);
  await page.getByLabel('Sort by').selectOption('high');
  await expect(page.getByRole('article').first()).toContainText('Island Fruit Bowl');
  await page.getByRole('searchbox').fill('lime');
  await expect(page.getByRole('article')).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole('searchbox')).toHaveValue('lime');
  await expect(page.getByLabel('Sort by')).toHaveValue('high');
  await page.getByRole('searchbox').fill('not a real flavour');
  await expect(page.getByText('No products match your search.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByRole('article')).toHaveCount(6);
  await page.getByLabel('Category').selectOption('seasonal');
  await expect(page.getByText('Sold out')).toBeVisible();
});

test('product pricing responds to size, add-ons, and quantity', async ({ page }) => {
  await page.goto('/menu/golden-mango');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Golden Mango');
  await expect(page.getByText(/LKR\s*690/, { exact: false }).first()).toBeAttached();
  await page.getByLabel('Size', { exact: true }).selectOption('large');
  await page.getByRole('checkbox', { name: /chia seeds/i }).check();
  await page.getByLabel('Quantity').selectOption('2');
  await expect(page.getByText('Preview total').locator('..')).toContainText(/LKR\s*1,940/);
  await expect(page.getByRole('heading', { name: 'You might also like' })).toBeVisible();
  await page.goto('/menu/unknown');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Product unavailable');
});

test('mobile navigation works by touch and keyboard; Sinhala survives reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Open menu' });
  await menu.click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await menu.click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Menu' }).click();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('main')).toBeFocused();
  await page.getByLabel('Language').selectOption('si');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('අපේ මෙනුව');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'si');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('අපේ මෙනුව');
  await page.getByRole('searchbox').fill('දෙහි');
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/නැවුම් රස/);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('gallery lightbox, FAQ disclosure, policy and missing routes work', async ({ page }) => {
  await page.goto('/gallery');
  await page.getByRole('button', { name: 'Open Golden Mango photo' }).click();
  await expect(page.getByRole('dialog', { name: 'Golden Mango' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('img')).toHaveAttribute('src', '/images/mango.webp');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.goto('/faq');
  await page.getByText('Can I order online?', { exact: true }).click();
  await expect(page.getByText(/You can browse the demo menu/)).toBeVisible();
  for (const [path, title] of [
    ['/about', 'About Zestora'],
    ['/privacy', 'Privacy policy'],
    ['/terms', 'Terms and conditions'],
    ['/refunds', 'Refund policy'],
    ['/cancellation', 'Cancellation policy'],
    ['/unknown', 'Page not found'],
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  }
});

test('configured contact links and translated form validation are visible', async ({ page }) => {
  await page.goto('/contact');
  await expect(page.getByRole('link', { name: 'hello@zestora.example' }).first()).toHaveAttribute('href', 'mailto:hello@zestora.example');
  await expect(page.getByRole('link', { name: 'Open in Google Maps' })).toHaveAttribute('href', /google\.com/);
  await page.getByRole('button', { name: 'Open email draft' }).click();
  await expect(page.getByRole('alert')).toHaveCount(3);
  await page.getByLabel('Language').selectOption('si');
  await expect(page.getByText('වලංගු විද්‍යුත් තැපැල් ලිපිනයක් ඇතුළත් කරන්න.')).toBeVisible();
});

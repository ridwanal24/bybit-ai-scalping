import { test, expect } from '@playwright/test';
import { researchPreset } from '@bybit/contracts';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/research/catalog?*', (route) =>
    route.fulfill({
      json: {
        datasets: [],
        models: [],
        evaluations: [],
        jobs: [],
        totals: {},
        errors: [],
      },
    }),
  );
  await page.route('**/api/configuration-presets', (route) =>
    route.fulfill({
      json: {
        items: [{ configuration: researchPreset() }],
      },
    }),
  );
  await page.route('**/api/configurations', (route) =>
    route.fulfill({ json: { items: [] } }),
  );
});

test('market selectors preserve timeframe edits and store date picker values as UTC milliseconds', async ({
  page,
}) => {
  await page.route('**/api/market-data/symbols', (route) =>
    route.fulfill({ json: { items: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'] } }),
  );
  await page.goto('/#configuration');
  await page.getByLabel('Search symbols', { exact: true }).fill('eth');
  const symbol = page.getByLabel('Symbol', { exact: true });
  await expect(symbol.locator('option')).toHaveCount(2);
  await symbol.selectOption('ETHUSDT');
  const secondary = page.getByRole('group', { name: 'Secondary timeframes' });
  await secondary.getByLabel('5m', { exact: true }).uncheck();
  await secondary.getByLabel('1h', { exact: true }).check();
  const start = page.getByLabel('Historical start (UTC)', { exact: false });
  const end = page.getByLabel('Historical end (UTC)', { exact: false });
  await expect(start).toHaveValue('2025-01-01T00:00');
  await start.fill('2025-02-01T12:30');
  await end.fill('2025-03-01T12:30');
  await page.getByText('Complete configuration JSON', { exact: true }).click();
  const payload = JSON.parse(
    await page
      .getByLabel('Complete configuration JSON', { exact: true })
      .inputValue(),
  );
  expect(payload.market).toMatchObject({
    symbol: 'ETHUSDT',
    secondary_timeframes: ['15m', '1h'],
    historical_start_ms: Date.parse('2025-02-01T12:30:00Z'),
    historical_end_ms: Date.parse('2025-03-01T12:30:00Z'),
  });
  await page.getByLabel('Timeframe', { exact: true }).selectOption('15m');
  const updated = JSON.parse(
    await page
      .getByLabel('Complete configuration JSON', { exact: true })
      .inputValue(),
  );
  expect(updated.market.secondary_timeframes).toEqual(['1h']);
  expect(
    updated.features.enabled.every((f: { timeframe: string }) =>
      ['15m', '1h'].includes(f.timeframe),
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('symbol fetch failure preserves the configuration and supports retry', async ({
  page,
}) => {
  let failed = true;
  await page.route('**/api/market-data/symbols', (route) =>
    failed
      ? route.fulfill({
          status: 503,
          json: { code: 'market_data_unavailable' },
        })
      : route.fulfill({ json: { items: ['BTCUSDT', 'ETHUSDT'] } }),
  );
  await page.goto('/#configuration');
  await expect(page.getByRole('alert')).toContainText('Could not load symbols');
  await expect(page.getByLabel('Symbol', { exact: true })).toHaveValue(
    'BTCUSDT',
  );
  failed = false;
  await page.getByRole('button', { name: 'Retry symbols' }).click();
  await expect(page.getByLabel('Symbol', { exact: true })).toBeEnabled();
  await page.getByLabel('Symbol', { exact: true }).selectOption('ETHUSDT');
});

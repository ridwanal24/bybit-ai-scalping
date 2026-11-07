import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const api = process.env.DASHBOARD_TEST_API!;
const fixtureRoot = process.env.DASHBOARD_TEST_ROOT!;
if (!api || !fixtureRoot || !process.env.DASHBOARD_TEST_REPORT)
  throw new Error('Use verify:dashboard with an isolated fixture');
test.describe.configure({ mode: 'serial' });
test('overview, real historical candles and desktop chart', async ({
  page,
  browser,
}) => {
  await fs.writeFile(
    path.join(fixtureRoot, 'browser.json'),
    JSON.stringify(
      {
        version: browser.version(),
        engine: browser.browserType().name(),
        viewport: page.viewportSize(),
      },
      null,
      2,
    ),
  );
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Research overview' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Historical closed candlestick chart' }),
  ).toBeVisible();
  await expect(page.getByText('fixture', { exact: true })).toBeVisible();
  await page.screenshot({
    path: path.join(fixtureRoot, 'desktop-overview.png'),
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Market data', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Market data', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Verified closed bars')).toBeVisible();
  await page.getByText('Closed candle values').click();
  await expect(
    page.getByRole('columnheader', { name: 'Volume', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('configuration CRUD, server validation, immutable snapshot and real training success', async ({
  page,
  request,
}) => {
  await page.goto('/#configuration');
  await page.getByRole('button', { name: /^Dashboard fixture v/ }).click();
  await page.getByRole('tab', { name: 'Risk', exact: true }).click();
  await page.getByLabel('risk per trade', { exact: true }).fill('1');
  await page
    .getByRole('button', { name: 'Validate configuration', exact: true })
    .click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('risk per trade', { exact: true }).fill('0.005');
  await page
    .getByRole('button', { name: 'Validate configuration', exact: true })
    .click();
  await expect(
    page.getByText(
      'Configuration valid. Exchange readiness is assessed separately.',
    ),
  ).toBeVisible();
  await page
    .getByLabel('Configuration name', { exact: true })
    .fill('Browser verified configuration');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByText(/Draft saved/)).toBeVisible();
  await page
    .getByRole('button', { name: 'Freeze snapshot', exact: true })
    .click();
  await expect(page.getByText(/frozen. Open Training/)).toBeVisible();
  await page.getByRole('link', { name: 'Training', exact: true }).click();
  await page.getByLabel(/I accept research-only/).check();
  const created = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/research/jobs') && r.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Start training', exact: true })
    .click();
  const response = await created;
  expect(response.status()).toBe(201);
  const job = await response.json();
  await expect
    .poll(
      async () => {
        const r = await request.get(api + '/research/jobs/' + job.job_id);
        return (await r.json()).state;
      },
      { timeout: 90000, intervals: [1000, 2000] },
    )
    .toBe('SUCCEEDED');
  await expect(page.getByText('Candidate model', { exact: false })).toBeVisible(
    { timeout: 30000 },
  );
  const status = await (
    await request.get(api + '/research/jobs/' + job.job_id)
  ).json();
  expect(status.model_id).toMatch(/^[a-f0-9]{64}$/);
  expect(status.checkpoints.length).toBeGreaterThan(0);
});
test('training cancellation is persistent and request paths cannot escape', async ({
  request,
}) => {
  const configs = await (await request.get(api + '/configurations')).json();
  const c = configs.items.find(
    (x: { name: string }) => x.name === 'Browser verified configuration',
  );
  const snap = await (
    await request.post(api + '/configurations/' + c.id + '/snapshots', {
      data: { expectedRevision: c.revision },
    })
  ).json();
  const fixture = JSON.parse(
    await fs.readFile(path.join(fixtureRoot, 'fixture.json'), 'utf8'),
  );
  const p = fixture.protocol;
  const body = {
    dataset_id: p.request.dataset_id,
    snapshot_id: snap.id,
    range_start_ms: p.request.range_start_ms,
    range_end_ms: p.request.range_end_ms,
    ppo_epochs: 2,
    resources: {
      cpu_threads: 1,
      max_wall_seconds: 120,
      max_memory_mb: 3072,
      max_timesteps: 64,
      max_checkpoints: 2,
    },
    policy: p.request.policy,
  };
  const created = await request.post(api + '/research/jobs', { data: body });
  expect(created.status()).toBe(201);
  const job = await created.json();
  const cancelled = await request.post(
    api + '/research/jobs/' + job.job_id + '/cancel',
    { data: {} },
  );
  expect(cancelled.ok()).toBe(true);
  await expect
    .poll(
      async () =>
        (await (await request.get(api + '/research/jobs/' + job.job_id)).json())
          .state,
      { timeout: 30000 },
    )
    .toBe('CANCELLED');
  const bad = await request.post(api + '/research/jobs', {
    data: { ...body, configuration_file: '../../secret' },
  });
  expect(bad.status()).toBe(400);
});
test('verified advanced metrics, baselines, equity/drawdown and trade history use real API', async ({
  page,
}) => {
  await page.goto('/#experiments');
  await expect(
    page.getByText('insufficient evidence', { exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await expect(
    page.getByRole('img', { name: 'Equity curve from verified ledger' }),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    page.getByRole('img', { name: 'Drawdown curve from verified ledger' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Trade history', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'ema_crossover', exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page
    .getByRole('button', { name: 'Inspect random', exact: true })
    .click();
  const baselineLedger = page.getByRole('region', {
    name: 'Baseline episode details',
  });
  await expect(
    baselineLedger.getByRole('cell', { name: /^(LONG|SHORT)$/ }).first(),
  ).toBeVisible({ timeout: 30000 });
  const picker = page.getByRole('combobox', {
    name: 'Experiment episode',
    exact: true,
  });
  await picker.selectOption('1');
  await expect(page.getByText(/Counterfactual: weights frozen/)).toBeVisible();
  await page.screenshot({
    path: path.join(fixtureRoot, 'desktop-experiments.png'),
    fullPage: true,
  });
});
test('model comparison, verified review and persisted proposal keep execution disabled', async ({
  page,
  request,
}) => {
  await page.goto('/#models');
  await expect(
    page.getByRole('heading', { name: 'Model comparison', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Archive verified', { exact: true })).toBeVisible(
    { timeout: 30000 },
  );
  await expect(
    page.getByRole('button', { name: 'Activate execution', exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel('Review note', { exact: true })
    .fill('Browser integration review of frozen research model.');
  await page.getByLabel(/I understand this is a research proposal/).check();
  await page
    .getByRole('button', { name: 'Record proposal', exact: true })
    .click();
  await expect(
    page.getByText('Research proposal recorded. No execution activated.'),
  ).toBeVisible({ timeout: 30000 });
  await page.reload();
  await expect(
    page.getByText('Browser integration review of frozen research model.'),
  ).toBeVisible();
  const denied = await request.post(api + '/research/activate', {
    data: { mode: 'real' },
  });
  expect(denied.status()).toBe(403);
  const hostile = await request.post(api + '/research/deployment-proposals', {
    headers: { origin: 'https://evil.example' },
    data: {},
  });
  expect(hostile.status()).toBe(403);
});
test('mobile navigation, chart and forms do not overflow the viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Research overview' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Historical closed candlestick chart' }),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(fixtureRoot, 'mobile-overview.png'),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('link', { name: 'Configuration', exact: true }).click();
  await expect(
    page.getByRole('tab', { name: 'Market', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: path.join(fixtureRoot, 'mobile-configuration.png'),
    fullPage: true,
  });
});
test('backend failure has retry state and loading stays explicit', async ({
  page,
}) => {
  await page.route('**/api/research/catalog?*', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'research_service_unavailable' }),
    }),
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Try again', exact: true }),
  ).toBeVisible();
  await page.unroute('**/api/research/catalog?*');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Research overview' }),
  ).toBeVisible();
  expect(
    await fs.stat(path.join(fixtureRoot, 'artifacts/deployment-proposals')),
  ).toBeTruthy();
});

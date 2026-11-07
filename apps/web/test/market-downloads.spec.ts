import { test, expect } from '@playwright/test';
import { researchPreset } from '@bybit/contracts';

const draft = {
  id: 'config-1',
  name: 'BTC weekly',
  revision: 3,
  payload: researchPreset(),
};
function download(status = 'RUNNING') {
  return {
    id: 'download-1',
    snapshot_id: 'snapshot-1',
    dataset_id: 'dataset-1',
    status,
    dataset_status: status === 'COMPLETED' ? 'READY' : 'BUILDING',
    preparing: status === 'RUNNING',
    exported: status === 'COMPLETED',
    symbol: 'BTCUSDT',
    start_ms: draft.payload.market.historical_start_ms,
    end_ms: draft.payload.market.historical_end_ms,
    streams: ['last:1m', 'last:5m', 'last:15m'],
    lease_expires: new Date(Date.now() + 120000).toISOString(),
    blocked_until: null,
    last_error: null,
    checkpoint: {
      initialized: true,
      phase: 'collect',
      metrics: { pages: 5, retries: 0 },
      streams: [{ id: 'last:1m', cursor_ms: null }],
    },
  };
}
test.beforeEach(async ({ page }) => {
  await page.route('**/api/health/ready', (route) =>
    route.fulfill({ json: { status: 'ok' } }),
  );
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
  await page.route('**/api/configurations?*', (route) =>
    route.fulfill({ json: { items: [draft] } }),
  );
});

test('starts from a saved configuration and restores completed downloads after reload', async ({
  page,
}) => {
  const calls: string[] = [];
  let rows: ReturnType<typeof download>[] = [];
  await page.route('**/api/market-data/downloads?*', (route) =>
    route.fulfill({ json: { items: rows } }),
  );
  await page.route(
    '**/api/configurations/config-1/snapshots',
    async (route) => {
      expect(route.request().postDataJSON()).toEqual({ expectedRevision: 3 });
      calls.push('snapshot');
      await route.fulfill({ json: { id: 'snapshot-1' } });
    },
  );
  await page.route('**/api/market-data/downloads', async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      configurationSnapshotId: 'snapshot-1',
    });
    calls.push('create');
    await route.fulfill({ json: { download_id: 'download-1' } });
  });
  await page.route(
    '**/api/market-data/downloads/download-1/start',
    async (route) => {
      calls.push('start');
      rows = [download()];
      await route.fulfill({ status: 202, json: {} });
    },
  );
  await page.goto('/#market');
  await page
    .getByLabel('Download configuration', { exact: true })
    .selectOption('config-1');
  await page
    .getByRole('button', { name: 'Download historical data', exact: true })
    .click();
  await expect(
    page.getByText('5 pages downloaded', { exact: false }),
  ).toBeVisible();
  expect(calls).toEqual(['snapshot', 'create', 'start']);
  rows = [download('COMPLETED')];
  await expect(
    page.getByText('Ready for training', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Open Training', exact: true }),
  ).toBeVisible();
  expect(calls).toEqual(['snapshot', 'create', 'start']);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.route('**/api/configuration-snapshots/snapshot-1', (route) =>
    route.fulfill({
      json: { id: 'snapshot-1', configHash: 'fixture', payload: draft.payload },
    }),
  );
  await page.route('**/api/research/catalog?*', (route) =>
    route.fulfill({
      json: {
        datasets: [
          {
            id: 'dataset-1',
            fingerprint: 'fixture',
            configuration_snapshot_id: 'snapshot-1',
            manifest: {
              symbol: 'BTCUSDT',
              source: 'bybit-mainnet',
              requested_start_ms: draft.payload.market.historical_start_ms,
              requested_end_ms: draft.payload.market.historical_end_ms,
              streams: [],
            },
          },
        ],
        models: [],
        evaluations: [],
        jobs: [],
        totals: {},
        errors: [],
      },
    }),
  );
  await page.reload();
  await page
    .getByRole('button', { name: 'Open Training', exact: true })
    .click();
  await expect(
    page.getByText('Frozen snapshot', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('combobox').first()).toHaveValue('dataset-1');
});

test('resumes a paused download and prevents resume during cooldown', async ({
  page,
}) => {
  let rows = [
    {
      ...download('PAUSED'),
      preparing: false,
      blocked_until: new Date(Date.now() + 600000).toISOString() as
        string | null,
    },
  ];
  let starts = 0;
  await page.route('**/api/market-data/downloads?*', (route) =>
    route.fulfill({ json: { items: rows } }),
  );
  await page.route(
    '**/api/market-data/downloads/download-1/start',
    async (route) => {
      starts++;
      rows = [{ ...download(), blocked_until: null }];
      await route.fulfill({ status: 202, json: {} });
    },
  );
  await page.goto('/#market');
  await expect(
    page.getByRole('button', { name: 'Resume download' }),
  ).toBeDisabled();
  rows[0]!.blocked_until = null;
  await page
    .getByRole('button', { name: 'Refresh downloads & configurations' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Resume download' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Resume download' }).click();
  await expect(page.getByText('RUNNING', { exact: true })).toBeVisible();
  expect(starts).toBe(1);
});

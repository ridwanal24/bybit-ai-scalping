import { defineConfig } from '@playwright/test';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
export default defineConfig({
  testDir: 'test',
  workers: 1,
  fullyParallel: false,
  timeout: 120000,
  expect: { timeout: 15000 },
  outputDir: path.join(root, '.runtime/dashboard-browser-results'),
  reporter: [
    ['list'],
    [
      'json',
      { outputFile: path.join(root, '.runtime/dashboard-browser-report.json') },
    ],
  ],
  use: {
    baseURL: process.env.DASHBOARD_TEST_URL ?? 'http://127.0.0.1:5174',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {}),
  },
});

import config from './vitest.config.js';

export default {
  ...config,
  test: {
    ...config.test,
    include: ['test/**/*.integration.ts'],
    testTimeout: 15000,
  },
};

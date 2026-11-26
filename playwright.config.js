// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 45_000,

  use: {
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'suite1-mobile-chrome-uk',
      testMatch: /analytics-consent\.spec\.js/,
      use: {
        ...devices['iPhone 15'],
        browserName: 'chromium',
        geolocation: { longitude: -0.1276, latitude: 51.5072 },
        permissions: ['geolocation'],
      },
    },
    {
      name: 'suite2-desktop-chrome-dark-uk',
      testMatch: /dark-mode-consent\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
      },
    },
  ],
});
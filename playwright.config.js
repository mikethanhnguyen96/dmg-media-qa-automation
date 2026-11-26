// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const isCI = !!process.env.CI;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 45_000,

  expect: {
    timeout: 10_000,
  },

  reporter: isCI
    ? [
        ['github'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }],
        ['junit', { outputFile: 'test-results/junit-results.xml' }],
      ]
    : [
        ['list'],
        ['html', { open: 'on-failure', outputFolder: 'playwright-report' }],
      ],

  use: {
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    geolocation: { latitude: 51.5074, longitude: -0.1278 }, // London, UK
    permissions: ['geolocation'],
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
    trace: 'retain-on-failure',
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
        isMobile: true,
        hasTouch: true,
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
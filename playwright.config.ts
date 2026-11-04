import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against a production build (`vite preview`), in a
 * desktop Chromium, an emulated Android phone (desktop app on a phone) and
 * three iPhone sizes (the iPhone version at /m/). Each test gets a fresh browser
 * context, so storage always starts empty.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /(mobile|ios)\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
    // The iPhone version (/m/). iPhone screen sizes, touch and user agents,
    // rendered by Chromium (WebKit isn't installed here — see MOBILE_PROGRESS.md).
    { name: 'iphone-se', use: { ...devices['iPhone SE (3rd gen)'], browserName: 'chromium', colorScheme: 'light' }, testMatch: /ios\.spec\.ts/ },
    { name: 'iphone-15-pro', use: { ...devices['iPhone 15 Pro'], browserName: 'chromium', colorScheme: 'dark' }, testMatch: /ios\.spec\.ts/ },
    { name: 'iphone-16-pro-max', use: { ...devices['iPhone 16 Pro Max'], browserName: 'chromium', colorScheme: 'light' }, testMatch: /ios\.spec\.ts/ },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})

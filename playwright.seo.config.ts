import { defineConfig } from '@playwright/test'

// Build with NEXT_PUBLIC_BASE_URL=https://peanut.me before running this suite.
// A preview build deliberately emits noindex and must fail these contracts.
const port = Number(process.env.SEO_PORT ?? 8777)
const baseURL = process.env.SEO_BASE_URL ?? `http://127.0.0.1:${port}`

export default defineConfig({
    testDir: './e2e/seo',
    outputDir: './e2e/__seo_results__',
    workers: 1,
    retries: 0,
    timeout: 15 * 60_000,
    reporter: [['list']],
    use: { baseURL, serviceWorkers: 'block', screenshot: 'off', video: 'off' },
    webServer: process.env.SEO_BASE_URL
        ? undefined
        : {
              command: `pnpm next start -p ${port}`,
              url: baseURL,
              reuseExistingServer: false,
              timeout: 120_000,
          },
})

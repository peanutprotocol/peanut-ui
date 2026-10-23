import { defineConfig, devices } from '@playwright/test'

// The parent QA run starts an isolated production build. Never adopt or start
// a server here: this suite must use the explicitly coordinated build.
export default defineConfig({
    testDir: './e2e/flows',
    testMatch: /\/marketing-qr[^/]*\.spec\.ts$/,
    outputDir: './e2e/__results__/marketing-qr',
    fullyParallel: false,
    workers: 1,
    retries: 0,
    timeout: 45_000,
    expect: { timeout: 12_000 },
    reporter: [['list']],
    use: {
        baseURL: process.env.MARKETING_QR_BASE_URL ?? 'http://localhost:8765',
        serviceWorkers: 'block',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'off',
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 } },
        {
            name: 'webkit',
            testIgnore: /marketing-qr-(routes|runtime)\.spec\.ts/,
            use: {
                ...devices['Desktop Safari'],
                deviceScaleFactor: 1,
                ...(process.env.MARKETING_QR_WEBKIT_EXECUTABLE
                    ? { launchOptions: { executablePath: process.env.MARKETING_QR_WEBKIT_EXECUTABLE } }
                    : {}),
            },
        },
    ],
})

import { defineConfig, devices } from '@playwright/test'

const baseUrlInput = process.env.MARKETING_QR_BASE_URL ?? 'http://localhost:8765'
const baseUrlError =
    'MARKETING_QR_BASE_URL must be an HTTP loopback origin without credentials, paths, query or fragments'
let baseUrl: URL
try {
    baseUrl = new URL(baseUrlInput)
} catch {
    throw new Error(baseUrlError)
}
if (
    baseUrl.protocol !== 'http:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(baseUrl.hostname) ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.pathname !== '/' ||
    baseUrl.search ||
    baseUrl.hash
) {
    throw new Error(baseUrlError)
}

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
        baseURL: baseUrl.origin,
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
            testIgnore: /marketing-qr-(routes|runtime|service-worker)\.spec\.ts/,
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

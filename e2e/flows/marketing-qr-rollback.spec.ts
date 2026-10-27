import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { decodeQr } from '../marketing-qr-decode'

// Run only against a separately rebuilt artifact with the public switch false.
// Changing the environment of `next start` cannot test a build-inlined flag.
test.describe('marketing QR disabled build', () => {
    test.skip(process.env.MARKETING_QR_ROLLBACK !== 'true', 'Requires the coordinated disabled build')
    test.use({
        viewport: { width: 1440, height: 900 },
        userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    })
    test.beforeEach(async ({ context, baseURL }) => {
        await context.route('**/*', async (route) => {
            const url = new URL(route.request().url())
            if (url.hostname === 'apps.apple.com' || url.hostname === 'play.google.com')
                return route.fulfill({ contentType: 'text/html', body: '<p>Store navigation intercepted by QA.</p>' })
            if (url.origin !== new URL(baseURL!).origin) return route.abort('blockedbyclient')
            if (url.pathname.startsWith('/api/') && url.pathname !== '/api/marketing-qr/open')
                return route.abort('blockedbyclient')
            if (url.pathname.startsWith('/relay/'))
                return route.fulfill({ json: { featureFlags: {}, featureFlagPayloads: {} } })
            if (url.pathname.startsWith('/monitoring')) return route.fulfill({ body: '{}' })
            return route.continue()
        })
    })

    test('new homepage QR pixels use the original app entry and renderer', async ({ page, context, baseURL }) => {
        await page.addInitScript(() => localStorage.setItem('pwa-sunset', 'true'))
        await page.goto('/?utm_source=google&utm_medium=cpc&utm_campaign=accounts-launch')
        await page.getByTestId('landing-download-cta').getByRole('link').click()
        const dialog = page.getByRole('dialog')
        await expect(dialog.getByAltText('qr center logo')).toBeVisible()
        await expect(dialog.locator('[data-qr-url]')).toHaveCount(0)
        const qr = dialog.locator('svg.ph-no-capture').first().locator('..')
        const decoded = new URL(await decodeQr(context, qr, baseURL!))
        if (process.env.MARKETING_QR_SHOTS === 'true') {
            const directory = path.resolve(__dirname, '../__shots__/marketing-qr')
            await mkdir(directory, { recursive: true })
            await page.screenshot({
                path: path.join(directory, `${test.info().project.name}-home-modal-disabled.png`),
                animations: 'disabled',
            })
        }
        expect(decoded.origin).toBe(new URL(baseURL!).origin)
        expect(decoded.pathname).toBe('/home')
        expect(decoded.searchParams.get('app_entry')).toBe('1')
        expect(decoded.searchParams.has('marketing_qr')).toBe(false)
    })

    for (const migrationOn of [false, true]) {
        test(`issued QR follows the real app/store continuation with migration ${migrationOn ? 'on' : 'off'}`, async ({
            page,
            context,
        }) => {
            const openings: string[] = []
            context.on('request', (request) => {
                if (new URL(request.url()).pathname === '/api/marketing-qr/open') openings.push(request.url())
            })
            await page.addInitScript((on) => {
                if (on) localStorage.setItem('pwa-sunset', 'true')
                else localStorage.removeItem('pwa-sunset')
            }, migrationOn)
            await page.goto('/q/home-hero-en?s=google&m=cpc&c=accounts-launch&o=current_url&a=none')
            await expect(page).toHaveURL(/\/app(?:\?|$)/)
            const continuation = new URL(page.url())
            expect(continuation.searchParams.get('marketing_qr')).toBe('home-hero-en')
            expect(continuation.searchParams.get('qr_analytics')).toBe('deny')
            expect([...continuation.searchParams.keys()].some((key) => key.startsWith('utm_'))).toBe(false)
            await expect(page.getByRole('button', { name: 'App Store', exact: true })).toBeVisible()
            await expect(page.getByRole('button', { name: 'Google Play', exact: true })).toBeVisible()
            const storeRequest = page.waitForRequest((request) => new URL(request.url()).hostname === 'play.google.com')
            await page.getByRole('button', { name: 'Google Play', exact: true }).click()
            const storeUrl = new URL((await storeRequest).url())
            expect(storeUrl.searchParams.get('id')).toBe('me.peanut.wallet')
            expect(storeUrl.searchParams.has('referrer')).toBe(false)
            expect(openings).toEqual([])
        })
    }
})

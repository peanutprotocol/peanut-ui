import { expect, test } from '@playwright/test'
import { decodeQr } from '../marketing-qr-decode'

// Run only against a separately rebuilt artifact with the public switch false.
// Changing the environment of `next start` cannot test a build-inlined flag.
test.describe('marketing QR disabled build', () => {
    test.skip(process.env.MARKETING_QR_ROLLBACK !== 'true', 'Requires the coordinated disabled build')
    test.use({
        userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    })
    test.beforeEach(async ({ context, baseURL }) => {
        await context.route('**/*', async (route) => {
            const url = new URL(route.request().url())
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
        expect(decoded.origin).toBe(new URL(baseURL!).origin)
        expect(decoded.pathname).toBe('/home')
        expect(decoded.searchParams.get('app_entry')).toBe('1')
        expect(decoded.searchParams.has('marketing_qr')).toBe(false)
    })

    test('already-issued QR reaches its safe continuation without capture or campaign storage', async ({
        page,
        context,
    }) => {
        const openings: string[] = []
        context.on('request', (request) => {
            if (new URL(request.url()).pathname === '/api/marketing-qr/open') openings.push(request.url())
        })
        await context.route('**/home?**', (route) =>
            route.fulfill({ contentType: 'text/html', body: '<p>Continue</p>' })
        )
        await page.goto('/q/home-hero-en?s=google&m=cpc&c=accounts-launch&o=current_url&a=none')
        await expect(page).toHaveURL(/\/home\?app_entry=1/)
        const continuation = new URL(page.url())
        expect(continuation.searchParams.get('marketing_qr')).toBe('home-hero-en')
        expect(continuation.searchParams.get('qr_analytics')).toBe('deny')
        expect(continuation.searchParams.has('utm_campaign')).toBe(false)
        expect(openings).toEqual([])
        expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([])
    })
})

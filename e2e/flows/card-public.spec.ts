/** Public card entry and provider restrictions, with deterministic API fixtures. */
import { expect, test, type Page } from '@playwright/test'
import { DEMO_USER } from '../../src/constants/demo-data'

const emptyOverview = { status: { hasApplication: false }, cards: [], balance: null }

type CardFixture = 'application' | 'prohibited' | 'pending' | 'holder' | 'guest'

async function installCardFixture(page: Page, fixture: CardFixture) {
    // Synthetic accounts have no real passkey; use the existing local harness bypass.
    await page.addInitScript(() => localStorage.setItem('__harness_skip_passkey', 'true'))
    if (fixture !== 'guest') {
        await page.context().addCookies([
            {
                name: 'jwt-token',
                value: 'card-public-fixture',
                url: test.info().project.use.baseURL || 'http://localhost:8766',
            },
        ])
    }
    await page.routeWebSocket('**/*', (socket) => socket.close())
    const user = {
        ...DEMO_USER,
        user: { ...DEMO_USER.user, username: 'cardapplicant', badges: [], isActivated: false },
        identityVerification: { status: 'not_started' },
        capabilities: { rails: [], restrictions: [], nextActions: [] },
    }
    const overview =
        fixture === 'pending'
            ? { ...emptyOverview, status: { hasApplication: true, railStatus: 'PENDING' } }
            : fixture === 'holder'
              ? {
                    ...emptyOverview,
                    status: { hasApplication: true, railStatus: 'ENABLED' },
                    cards: [
                        {
                            id: 'fixture-card',
                            rainCardId: 'fixture-rain',
                            status: 'ACTIVE',
                            last4: '0420',
                            expiryMonth: 6,
                            expiryYear: 2069,
                            network: 'visa',
                            issuedAt: '2026-01-01T00:00:00Z',
                            hasWithdrawApproval: false,
                        },
                    ],
                }
              : emptyOverview
    const apiCalls: string[] = []
    await page.route('**/*', async (route) => {
        const url = new URL(route.request().url())
        const method = route.request().method()
        const isApi = url.port === '5050' || url.hostname === 'api.peanut.me'
        if (!isApi) {
            if (['127.0.0.1', 'localhost'].includes(url.hostname)) return route.continue()
            return route.abort()
        }
        apiCalls.push(`${method} ${url.pathname}`)
        const headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': '*',
        }
        if (method === 'OPTIONS') return route.fulfill({ status: 204, headers })
        let body: unknown = {}
        if (url.pathname === '/users/me') {
            if (fixture === 'guest') return route.fulfill({ status: 401, headers, json: { error: 'Unauthenticated' } })
            body = user
        } else if (url.pathname === '/card') {
            body = { isEligible: false, geoProhibited: fixture === 'prohibited' || fixture === 'holder' }
        } else if (url.pathname === '/rain/cards') {
            body = method === 'POST' ? { status: 'terms-required', isUsResident: false } : overview
        } else if (url.pathname === '/users/consent/status') {
            body = { documents: [], needsAcceptance: false }
        } else if (url.pathname === '/tokens/wallet-portfolio') {
            body = { balances: [], totalBalance: 0 }
        } else if (url.pathname.includes('/history')) {
            body = { entries: [], hasMore: false }
        }
        return route.fulfill({ status: 200, headers, json: body })
    })
    return apiCalls
}

async function shot(page: Page, name: string) {
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({
        path: `${process.env.CARD_SHOTS_OUT || '/tmp/card-public-shots'}/${name}.png`,
        animations: 'disabled',
    })
}

test.use({ storageState: { cookies: [], origins: [] } })

test('an ordinary account reaches the application and card terms without a queue or deposit', async ({ page }) => {
    const calls = await installCardFixture(page, 'application')
    await page.goto('/card')
    const apply = page.getByRole('button', { name: 'Get your card', exact: true })
    await expect(apply).toBeVisible()
    await expect(page.getByText(/closed beta|try the door|join.*waitlist/i)).toHaveCount(0)
    await shot(page, 'application')
    await apply.evaluate((button) => button.scrollIntoView({ block: 'center', behavior: 'instant' }))
    await expect(apply).toBeInViewport({ ratio: 0.99 })
    await shot(page, 'application-cta')
    await apply.click()
    await expect(page.getByText('Card Terms', { exact: true })).toBeVisible()
    expect(calls).toContain('POST /rain/cards')
    expect(calls.some((call) => /waitlist|flow-early-access|purchase/.test(call))).toBe(false)
    await shot(page, 'terms')
})

test('known prohibited geography keeps its regulatory screen', async ({ page }) => {
    await installCardFixture(page, 'prohibited')
    await page.goto('/card')
    await expect(page.getByText("Cards aren't available in your region yet")).toBeVisible()
    await expect(page.getByRole('button', { name: 'Get your card', exact: true })).toHaveCount(0)
    await shot(page, 'prohibited')
})

test('an existing application keeps its pending provider status', async ({ page }) => {
    await installCardFixture(page, 'pending')
    await page.goto('/card')
    await expect(page.getByText('Setting up your card…')).toBeVisible()
    await shot(page, 'pending')
})

test('an existing holder can manage their card even with a prohibited residence', async ({ page }) => {
    await installCardFixture(page, 'holder')
    await page.goto('/card')
    await expect(page.getByText('Card management', { exact: true })).toBeVisible()
    await expect(page.getByText("Cards aren't available in your region yet")).toHaveCount(0)
    await shot(page, 'holder')
})

test('the public landing sends a guest to signup with the card destination', async ({ page }) => {
    await installCardFixture(page, 'guest')
    await page.goto('/shhhhh')
    await expect(page.getByRole('heading', { level: 1, name: 'Peanut Card' })).toBeVisible()
    await shot(page, 'landing')
    await page.getByRole('button', { name: 'Get your card', exact: true }).first().click()
    await expect(page).toHaveURL(/\/setup\?redirect_uri=%2Fcard/)
})

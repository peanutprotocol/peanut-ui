/**
 * Public card entry and provider restrictions.
 *
 * Authenticated states run through the in-app fixture layer (?__fixture=…):
 * it answers every API call inside api-fetch and the kernel client skips the
 * passkey path for an active fixture, so no harness build flag is needed.
 * The guest test intercepts the network instead — a signed-out visitor has no
 * fixture session, and the assertion is about the signup redirect.
 */
import { expect, test, type Page } from '@playwright/test'

async function shot(page: Page, name: string) {
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({
        path: `${process.env.CARD_SHOTS_OUT || '/tmp/card-public-shots'}/${name}.png`,
        animations: 'disabled',
        // CSS pixels, not device pixels: the Pixel 7 DPR turns 390x844 into
        // 1024x2216, past the 2000px cap on images an agent can read back.
        scale: 'css',
    })
}

test.use({ storageState: { cookies: [], origins: [] } })

test.beforeEach(async ({ page }) => {
    // Fixture controls must not cover product controls or visual evidence.
    await page.addInitScript(() => {
        ;(window as Window & { __screenCapture?: boolean }).__screenCapture = true
    })
})

test('an ordinary account reaches the application and card terms without a queue or deposit', async ({ page }) => {
    await page.goto('/card?__fixture=card-application')
    const apply = page.getByRole('button', { name: 'Get your card', exact: true })
    await expect(apply).toBeVisible()
    await expect(page.getByText(/closed beta|try the door|join.*waitlist/i)).toHaveCount(0)
    await shot(page, 'application')
    await apply.evaluate((button) => button.scrollIntoView({ block: 'center', behavior: 'instant' }))
    await expect(apply).toBeInViewport({ ratio: 0.99 })
    await shot(page, 'application-cta')
    await apply.click()
    await expect(page.getByText('Card Terms', { exact: true })).toBeVisible()
    await shot(page, 'terms')
})

test('known prohibited geography keeps its regulatory screen', async ({ page }) => {
    await page.goto('/card?__fixture=card-prohibited')
    await expect(page.getByText("Cards aren't available in your region yet")).toBeVisible()
    await expect(page.getByRole('button', { name: 'Get your card', exact: true })).toHaveCount(0)
    await shot(page, 'prohibited')
})

test('an existing application keeps its pending provider status', async ({ page }) => {
    await page.goto('/card?__fixture=card-pending')
    await expect(page.getByText('Setting up your card…')).toBeVisible()
    await shot(page, 'pending')
})

test('an existing holder can manage their card even with a prohibited residence', async ({ page }) => {
    await page.goto('/card?__fixture=card-holder')
    await expect(page.getByText('Card management', { exact: true })).toBeVisible()
    await expect(page.getByText("Cards aren't available in your region yet")).toHaveCount(0)
    // card payments already enabled: no funding callout
    await expect(page.getByTestId('enable-card-payments')).toHaveCount(0)
    await shot(page, 'holder')
})

test('an existing holder without the Rain approval is asked to enable card payments', async ({ page }) => {
    await page.goto('/card?__fixture=card-funding-needed')
    await expect(page.getByTestId('enable-card-payments')).toBeVisible()
    await expect(page.getByText('Card management', { exact: true })).toBeVisible()
    await shot(page, 'funding-needed')
})

test('an unreadable funding status shows a retry and keeps card management', async ({ page }) => {
    await page.goto('/card?__fixture=card-funding-error')
    await expect(page.getByTestId('card-funding-error')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
    await expect(page.getByText('Card management', { exact: true })).toBeVisible()
    await shot(page, 'funding-error')
})

test('re-issuing a card explains the Rain wallet permission on the terms step', async ({ page }) => {
    await page.goto('/card?__fixture=card-reissue')
    await page.getByRole('button', { name: 'Get your card', exact: true }).click()
    await expect(page.getByText('Card Terms', { exact: true })).toBeVisible()
    const permission = page.getByText(/Approve Rain, our card issuer, to take USDC from your wallet/)
    await expect(permission).toBeVisible()
    await permission.scrollIntoViewIfNeeded()
    await shot(page, 'reissue-terms')
})

test('cancelling the last card offers to remove the Rain permission afterwards', async ({ page }) => {
    await page.goto('/card?__fixture=card-funding-enabled')
    await page.getByRole('button', { name: 'Cancel card', exact: true }).click()
    // The slide handle takes arrow keys (10% of the travel per press), so the
    // confirm is deterministic. Keys go to the page, not to a locator: the
    // handle disables and then unmounts as the cancel runs, and a locator
    // action would wait on it.
    const handle = page.getByRole('button', { name: 'Slide to Cancel', exact: true })
    await expect(handle).toBeVisible()
    await handle.focus()
    for (let press = 0; press < 10; press++) await page.keyboard.press('ArrowRight')
    const revokeTitle = page.getByText("Remove Rain's permission", { exact: true })
    await expect(revokeTitle).toBeVisible()
    await expect(page.getByRole('button', { name: 'Not now', exact: true })).toBeVisible()
    await shot(page, 'cancel-revoke')
})

// Guests have no fixture session; stub the API at the network layer so the
// page settles as signed-out whatever API URL the build carries.
async function stubSignedOutApi(page: Page) {
    const appPort = new URL(test.info().project.use.baseURL || 'http://127.0.0.1:3081').port
    await page.route('**/*', async (route) => {
        const url = new URL(route.request().url())
        const isAppServer = ['127.0.0.1', 'localhost'].includes(url.hostname) && url.port === appPort
        if (isAppServer) return route.continue()
        const headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': '*',
        }
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
        if (url.pathname === '/users/me') {
            return route.fulfill({ status: 401, headers, json: { error: 'Unauthenticated' } })
        }
        return route.fulfill({ status: 200, headers, json: {} })
    })
}

test('a signed-out visitor to /card is redirected to /setup — public access is not unauthenticated access', async ({
    page,
}) => {
    // No fixture and no session: the real auth gate runs (replaces the
    // deleted card-pioneer.e2e.test.ts coverage).
    await stubSignedOutApi(page)
    await page.goto('/card')
    await page.waitForURL(/\/setup/, { timeout: 10_000 })
})

test('the public landing sends a guest to signup with the card destination', async ({ page }) => {
    await stubSignedOutApi(page)
    await page.goto('/shhhhh')
    await expect(page.getByRole('heading', { level: 1, name: 'Peanut Card' })).toBeVisible()
    await shot(page, 'landing')
    await page.getByRole('button', { name: 'Get your card', exact: true }).first().click()
    await expect(page).toHaveURL(/\/setup\?redirect_uri=%2Fcard/)
})

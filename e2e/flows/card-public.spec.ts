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

/**
 * Model a returning holder who dismissed Home's first-visit dialogs. The
 * fixture balance would otherwise open a separate warning over the card
 * prompt. These are the same stored values used by the screenshot fixtures.
 */
async function asReturningHomeVisitor(page: Page) {
    await page.addInitScript(() => {
        window.localStorage.setItem('peanut_demo_activation_celebrated_at', '2026-01-01T00:00:00.000Z')
        window.localStorage.setItem(
            'demo-user:user-preferences',
            JSON.stringify({ hasSeenBalanceWarning: { value: true, expiry: 4102444800000 } })
        )
    })
}

test('an ordinary account reaches the application and card terms without a queue or deposit', async ({ page }) => {
    await page.goto('/card?__fixture=card-application')
    const apply = page.getByRole('button', { name: 'Get card', exact: true })
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
    await expect(page.getByText("Cards aren't available in this region yet")).toBeVisible()
    await expect(page.getByRole('button', { name: 'Get card', exact: true })).toHaveCount(0)
    await shot(page, 'prohibited')
})

test('an existing application keeps its pending provider status', async ({ page }) => {
    await page.goto('/card?__fixture=card-pending')
    await expect(page.getByText('Setting up card…')).toBeVisible()
    await shot(page, 'pending')
})

test('an existing holder can manage their card even with a prohibited residence', async ({ page }) => {
    await page.goto('/card?__fixture=card-holder')
    await expect(page.getByText('Card management', { exact: true })).toBeVisible()
    await expect(page.getByText("Cards aren't available in this region yet")).toHaveCount(0)
    // permission already ready: the Home prompt has nothing to ask
    await expect(page.getByTestId('card-funding-consent')).toHaveCount(0)
    await shot(page, 'holder')
})

test('an existing holder without the funding permission gets the centered Home prompt with two unchecked boxes', async ({
    page,
}) => {
    await asReturningHomeVisitor(page)
    await page.goto('/home?__fixture=card-funding-needed')
    await expect(page.getByText('Finish setting up the card', { exact: true })).toBeVisible()
    await expect(page.getByText('One passkey tap to start using your card.')).toBeVisible()
    const boxes = page.getByRole('checkbox')
    await expect(boxes).toHaveCount(2)
    for (const box of await boxes.all()) await expect(box).not.toBeChecked()
    await expect(page.getByText('I authorize transfers according to the Real-Time Funding Terms.')).toBeVisible()
    const cont = page.getByRole('button', { name: 'Continue', exact: true })
    await expect(cont).toBeDisabled()
    // no way out before a failure: no close button and no skip
    await expect(page.getByText('Skip for now')).toHaveCount(0)
    await shot(page, 'funding-needed')
    // ticking both, and only both, enables Continue. The native input is
    // visually hidden (`sr-only`); a person taps the visible box, which is its label.
    const tick = (index: number) =>
        page
            .locator('label')
            .filter({ has: page.getByRole('checkbox') })
            .nth(index)
            .click()
    await tick(0)
    await expect(boxes.nth(0)).toBeChecked()
    await expect(cont).toBeDisabled()
    await tick(1)
    await expect(boxes.nth(1)).toBeChecked()
    await expect(cont).toBeEnabled()
    await shot(page, 'funding-needed-ticked')
})

test('a legacy holder is told there are two confirmations', async ({ page }) => {
    await asReturningHomeVisitor(page)
    await page.goto('/home?__fixture=card-funding-migration')
    await expect(page.getByText(/confirm twice with your passkey/i)).toBeVisible()
    await expect(page.getByText('One passkey tap to start using your card.')).toHaveCount(0)
    await shot(page, 'funding-migration')
})

test('a grant waiting for confirmation shows Check status and Skip, not the boxes', async ({ page }) => {
    await asReturningHomeVisitor(page)
    await page.goto('/home?__fixture=card-funding-pending')
    await expect(page.getByRole('button', { name: 'Check status', exact: true })).toBeVisible()
    await expect(page.getByText('Skip for now')).toBeVisible()
    await expect(page.getByRole('checkbox')).toHaveCount(0)
    await shot(page, 'funding-pending')
})

test('Home asks for nothing when the permission is ready, paused, or its state cannot be read', async ({ page }) => {
    await asReturningHomeVisitor(page)
    for (const fixture of ['card-funding-enabled', 'card-funding-unavailable', 'card-funding-error']) {
        await page.goto(`/home?__fixture=${fixture}`)
        await expect(page.getByText('Activity', { exact: true }).first()).toBeVisible()
        await expect(page.getByText('Finish setting up the card')).toHaveCount(0)
    }
})

test('re-issuing a card ends the card terms with the two new unchecked boxes', async ({ page }) => {
    await page.goto('/card?__fixture=card-reissue')
    await page.getByRole('button', { name: 'Get card', exact: true }).click()
    await expect(page.getByText('Card Terms', { exact: true })).toBeVisible()
    const boxes = page.getByRole('checkbox')
    // international: the four original rows, then the two new ones
    await expect(boxes).toHaveCount(6)
    for (const box of await boxes.all()) await expect(box).not.toBeChecked()
    const statement = page.getByText('I authorize transfers according to the Real-Time Funding Terms.')
    await expect(statement).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
    await statement.scrollIntoViewIfNeeded()
    await shot(page, 'reissue-terms')
})

test('cancelling a card is an ordinary cancel with no permission-removal step', async ({ page }) => {
    await page.goto('/card?__fixture=card-cancel')
    await page.getByRole('button', { name: 'Cancel card', exact: true }).click()
    // The slide handle takes arrow keys (10% of the travel per press), so the
    // confirm is deterministic. Keys go to the page, not to a locator: the
    // handle disables and then unmounts as the cancel runs, and a locator
    // action would wait on it.
    const handle = page.getByRole('button', { name: 'Slide to cancel', exact: true })
    await expect(handle).toBeVisible()
    await handle.focus()
    for (let press = 0; press < 10; press++) await page.keyboard.press('ArrowRight')
    await expect(page.getByText('Card canceled', { exact: true })).toBeVisible()
    await expect(page.getByText(/permission/i)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Not now', exact: true })).toHaveCount(0)
    await shot(page, 'cancel-feedback')
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
    await expect(page.getByRole('heading', { level: 1, name: 'Peanut Card Go Pink.' })).toBeVisible()
    await shot(page, 'landing')
    await page.getByRole('button', { name: 'Get card', exact: true }).first().click()
    await expect(page).toHaveURL(/\/setup\?redirect_uri=%2Fcard/)
})

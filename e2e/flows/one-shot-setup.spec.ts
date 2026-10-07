/**
 * One-shot onboarding, the Brazil path (TASK-23329, item 9a): Home's Verify
 * row → the unlock checklist → the Sumsub SDK on the one-shot level → the
 * setup drawer with one row per ticked feature. And the interrupted session:
 * closing the SDK halfway and tapping Verify again reopens the SDK without
 * asking the checklist twice.
 *
 * And the Unlock tap on Accounts (item 8c): the method's own sheet asks which
 * ID to use, stores the tapped feature and opens the SDK, with no checklist.
 *
 * UI assertions only. No API and no login: `?__fixture=one-shot-setup-br`
 * answers every call. The Sumsub WebSDK is a stub installed on `window`
 * before the page scripts run, so nothing loads from static.sumsub.com and
 * the spec decides whether the applicant gets submitted.
 */

import { test, expect, type Page } from '@playwright/test'

test.use({ viewport: { width: 375, height: 667 } })

// The builder chain useSumsubWebSdk calls on window.snsWebSdk. launch() marks
// its container, and, when told to, reports the applicant as submitted the
// way the real SDK does once the user finishes the last step.
async function stubSumsubSdk(page: Page, { submits }: { submits: boolean }) {
    await page.addInitScript((submits: boolean) => {
        const handlers: Record<string, () => void> = {}
        const builder = {
            withConf: () => builder,
            withOptions: () => builder,
            on: (event: string, handler: () => void) => {
                handlers[event] = handler
                return builder
            },
            build: () => ({
                launch: (container: HTMLElement) => {
                    container.setAttribute('data-sumsub-stub', 'launched')
                    if (submits) setTimeout(() => handlers.onApplicantSubmitted?.(), 300)
                },
                destroy: () => {},
            }),
        }
        ;(window as unknown as { snsWebSdk: unknown }).snsWebSdk = { init: () => builder }
    }, submits)
}

async function openChecklistAndUnlock(page: Page) {
    await page.goto('/home?__fixture=one-shot-setup-br', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('checklist-verify-identity').click({ timeout: 60_000 })
    // every feature is open in Brazil, every row ticked
    for (const key of ['qr', 'local', 'card', 'bank']) {
        await expect(page.getByTestId(`unlock-row-${key}`).getByRole('switch')).toBeChecked()
    }
    await page.getByRole('button', { name: 'Unlock features' }).click()
    await expect(page.locator('[data-sumsub-stub="launched"]')).toBeAttached({ timeout: 30_000 })
}

test.describe('one-shot onboarding in Brazil', () => {
    test('after the SDK the setup drawer lists every ticked feature, under review until the ID check passes', async ({
        page,
    }) => {
        await stubSumsubSdk(page, { submits: true })
        await openChecklistAndUnlock(page)

        const drawer = page.getByTestId('one-shot-setup')
        await expect(drawer).toBeVisible({ timeout: 30_000 })
        await expect(drawer.getByRole('heading', { name: 'Setting up' })).toBeVisible()
        const expected: Record<string, string> = {
            qr: 'QR payments',
            local: 'BRL bank transfers',
            card: 'Peanut Card',
            bank: 'USD and EUR accounts',
        }
        for (const [key, title] of Object.entries(expected)) {
            const row = drawer.getByTestId(`setup-row-${key}`)
            await expect(row).toContainText(title)
            // the card's agreements are on file (pending-identity): its step is done
            await expect(row).toContainText(key === 'card' ? 'Setting up' : 'Under review')
        }
        // the SDK is gone, and the phase modal never shows for this user
        await expect(page.locator('[data-sumsub-stub]')).toHaveCount(0)
        await expect(page.getByText('Checking ID')).toHaveCount(0)

        await drawer.getByRole('button', { name: 'Go to Home' }).click()
        await expect(drawer).toBeHidden()
    })

    test('closing the SDK halfway and verifying again resumes without the checklist', async ({ page }) => {
        await stubSumsubSdk(page, { submits: false })
        await openChecklistAndUnlock(page)

        // the SDK's own close asks before giving up the session
        await page.getByRole('button', { name: 'Close', exact: true }).first().click()
        await page.getByRole('button', { name: 'Exit', exact: true }).click()
        await expect(page.locator('[data-sumsub-stub]')).toHaveCount(0)
        await expect(page.getByTestId('one-shot-setup')).toHaveCount(0)

        await page.getByTestId('checklist-verify-identity').click()
        // today's start screen, not the questions again
        await expect(page.getByRole('button', { name: 'Verify identity' })).toBeVisible()
        await expect(page.getByTestId('unlock-row-qr')).toHaveCount(0)
        await page.getByRole('button', { name: 'Verify identity' }).click()
        await expect(page.locator('[data-sumsub-stub="launched"]')).toBeAttached({ timeout: 30_000 })
    })
})

test.describe('one-shot unlock from a method on Accounts', () => {
    async function tapEuroUnlock(page: Page, fixture: string) {
        await page.goto(`/profile/accounts?__fixture=${fixture}`, { waitUntil: 'domcontentloaded' })
        await page.getByTestId('bank-row-sepa').click({ timeout: 60_000 })
        await expect(page.getByRole('heading', { name: 'Unlock EUR · Bank transfer' })).toBeVisible()
        await expect(page.getByRole('radio', { name: 'ID issued by Spain' })).toBeChecked()
    }

    async function answerForeignId(page: Page, country: string) {
        await page.getByRole('radio', { name: 'ID issued by another country' }).click()
        await page.getByRole('combobox', { name: 'Issuing country' }).fill(country)
        await page.getByRole('option', { name: country }).click()
    }

    test('the tap on EUR asks which ID to use, then sets up that method and QR only', async ({ page }) => {
        await stubSumsubSdk(page, { submits: true })
        await tapEuroUnlock(page, 'one-shot-unlock-method')
        // the sheet keeps its list of what to have ready, and shows no checklist rows
        await expect(page.getByTestId('kyc-prep-checklist')).toBeVisible()
        await expect(page.getByTestId('unlock-row-qr')).toHaveCount(0)

        await answerForeignId(page, 'France')
        await page.getByRole('button', { name: 'I have these, start' }).click()
        await expect(page.locator('[data-sumsub-stub="launched"]')).toBeAttached({ timeout: 30_000 })

        // the setup drawer lists the stored set: the tapped feature and QR
        const drawer = page.getByTestId('one-shot-setup')
        await expect(drawer).toBeVisible({ timeout: 30_000 })
        await expect(drawer.getByTestId('setup-row-qr')).toContainText('QR payments')
        await expect(drawer.getByTestId('setup-row-bank')).toContainText('USD and EUR accounts')
        await expect(drawer.getByTestId('setup-row-card')).toHaveCount(0)
        await expect(drawer.getByTestId('setup-row-local')).toHaveCount(0)
    })

    test('an ID that cannot open the method says which ID would, and offers QR payments alone', async ({ page }) => {
        await tapEuroUnlock(page, 'one-shot-unlock-method-foreign-id')
        await answerForeignId(page, 'Venezuela')

        const refusal = page.getByTestId('unlock-method-refused')
        await expect(refusal).toContainText('EUR · Bank transfer')
        await expect(refusal).toContainText('Needs an ID issued by Spain')
        await expect(page.getByRole('button', { name: 'Unlock QR payments' })).toBeEnabled()
        await expect(page.getByRole('button', { name: 'I have these, start' })).toHaveCount(0)
    })
})

/**
 * Item 8c, second part (D16): a user who already passed the one-shot check
 * adds a feature from the same tap. No ID question, no SDK: the stored set
 * grows by the tapped feature, PUT /users/kyc-intents sets it up, and the
 * setup drawer shows the rows. The fixture answers the PUT inside the app, so
 * the proof that no check starts is the SDK stub: it is never launched.
 */
test.describe('one-shot unlock from a method after the check', () => {
    test('the tap on EUR adds the accounts to the stored set and opens the setup drawer, with no new check', async ({
        page,
    }) => {
        await stubSumsubSdk(page, { submits: false })
        await page.goto('/profile/accounts?__fixture=one-shot-unlock-add', { waitUntil: 'domcontentloaded' })
        await page.getByTestId('bank-row-sepa').click({ timeout: 60_000 })
        await expect(page.getByRole('heading', { name: 'Unlock EUR · Bank transfer' })).toBeVisible()
        // no ID question, no list of what to have ready
        await expect(page.getByText('Identity verified. No new check needed.')).toBeVisible()
        await expect(page.getByRole('radiogroup')).toHaveCount(0)
        await expect(page.getByTestId('kyc-prep-checklist')).toHaveCount(0)

        await page.getByRole('button', { name: 'Set up now' }).click()

        // the drawer lists the stored set: the ticks that were there (QR) and the tapped feature
        const drawer = page.getByTestId('one-shot-setup')
        await expect(drawer).toBeVisible({ timeout: 30_000 })
        await expect(drawer.getByTestId('setup-row-qr')).toContainText('QR payments')
        await expect(drawer.getByTestId('setup-row-qr')).toContainText('Available')
        await expect(drawer.getByTestId('setup-row-bank')).toContainText('USD and EUR accounts')
        await expect(drawer.getByTestId('setup-row-bank')).toContainText('Setting up')
        await expect(drawer.getByTestId('setup-row-local')).toHaveCount(0)
        await expect(drawer.getByTestId('setup-row-card')).toHaveCount(0)
        await expect(page.locator('[data-sumsub-stub="launched"]')).toHaveCount(0)
    })
})

/**
 * Item 9b: the card step after the session, and the state a refused document
 * leaves. The SDK stub submits every session it launches, the identity one and
 * the card questions alike; the fixtures answer POST /rain/cards in turn.
 */
test.describe('one-shot onboarding in Brazil with the card', () => {
    async function unlockFrom(page: Page, fixture: string) {
        await page.goto(`/home?__fixture=${fixture}`, { waitUntil: 'domcontentloaded' })
        await page.getByTestId('checklist-verify-identity').click({ timeout: 60_000 })
        await expect(page.getByTestId('unlock-row-card').getByRole('switch')).toBeChecked()
        await page.getByRole('button', { name: 'Unlock features' }).click()
        await expect(page.locator('[data-sumsub-stub="launched"]')).toBeAttached({ timeout: 30_000 })
    }

    test('the session closes, the card questions open, the agreements follow, and the card row reads setting up', async ({
        page,
    }) => {
        await stubSumsubSdk(page, { submits: true })
        await unlockFrom(page, 'one-shot-setup-br-card')

        // the agreements come after the questions; the setup drawer waits behind both
        const terms = page.getByTestId('one-shot-card-terms')
        await expect(terms).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('one-shot-setup')).toHaveCount(0)
        // the native input is sr-only; the user taps the drawn box, its label
        for (const box of await terms.locator('label').all()) await box.click()
        await expect(terms.getByRole('checkbox').first()).toBeChecked()
        await terms.getByRole('button', { name: 'Continue' }).click()

        const drawer = page.getByTestId('one-shot-setup')
        await expect(drawer).toBeVisible({ timeout: 30_000 })
        await expect(drawer.getByTestId('setup-row-card')).toContainText('Setting up')
        await expect(drawer.getByTestId('setup-row-qr')).toContainText('Under review')
        await expect(drawer.getByTestId('setup-row-bank')).toContainText('Under review')
        await expect(drawer.getByRole('button', { name: 'Go to Home' })).toBeVisible()
    })

    test('a document the card partner refuses: the card row asks for a Brazilian ID and the button starts a new check', async ({
        page,
    }) => {
        await stubSumsubSdk(page, { submits: true })
        await unlockFrom(page, 'one-shot-setup-br-card-refused')

        const drawer = page.getByTestId('one-shot-setup')
        await expect(drawer).toBeVisible({ timeout: 30_000 })
        const card = drawer.getByTestId('setup-row-card')
        await expect(card).toContainText('Verify ID')
        await expect(card).toContainText('Needs an ID issued by Brazil')
        await expect(drawer.getByText('Starts a new identity check.')).toBeVisible()

        await drawer.getByRole('button', { name: 'Verify again with a Brazil ID' }).click()
        // the identity restart opens the SDK again, on the same level
        await expect(page.locator('[data-sumsub-stub="launched"]')).toBeAttached({ timeout: 30_000 })
        await expect(drawer).toBeHidden()
    })
})

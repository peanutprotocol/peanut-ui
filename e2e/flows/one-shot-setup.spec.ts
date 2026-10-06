/**
 * One-shot onboarding, the Brazil path (TASK-23329, item 9a): Home's Verify
 * row → the unlock checklist → the Sumsub SDK on the one-shot level → the
 * setup drawer with one row per ticked feature. And the interrupted session:
 * closing the SDK halfway and tapping Verify again reopens the SDK without
 * asking the checklist twice.
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
            await expect(row).toContainText('Under review')
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

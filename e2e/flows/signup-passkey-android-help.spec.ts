/**
 * 03 Passkey: the Android app's help screens (TASK-25047), in a browser at 375x667.
 *
 * WHAT THIS PROVES
 * - Each new screen renders from its dev surface with the catalog copy: the second-cancel help, the two timeout
 *   screens (sheet hung, left the app) and the two pre-check screens (no screen lock, no password manager).
 * - The buttons each screen offers, in order: Try again (+ support line), or Open settings then Try again.
 *
 * WHAT IT DOES NOT PROVE
 * - That a phone reaches these states. The Android plugin, its cancel messages, the timer's outcome and the
 *   pre-check's getReadiness() run only in the app; the hook's mapping is checked in
 *   src/features/setup/__tests__/useSignupPasskey.test.tsx. The browser cancel path (inline line, then retry) is
 *   signup-redesign.spec.ts C-60.
 * - That Open settings opens Android's Security settings: that needs a real Android build.
 *
 * HOW TO RUN
 *   npm run build && npm run test:e2e:regression -- signup-passkey-android-help --workers=1
 */
import { expect, test, type Page } from '@playwright/test'
import en from '../../src/i18n/app/messages/en.json'

const passkey = en.setupRedesign.passkey
const retry = en.setupRedesign.common.retry
const supportLink = en.setupRedesign.common.support.replace(/^.*<link>(.*)<\/link>.*$/, '$1')
// The passkey fixture answers the screen's username and residence calls.
const FIXTURE = 'setup-redesign-passkey-default'

type Case = {
    surface: string
    state: string
    title: string
    lead: string
    steps: string[]
    settings: boolean
}

const CASES: Case[] = [
    {
        surface: 'setup-redesign-passkey-second-cancel',
        state: 'second-cancel',
        title: passkey.secondCancelTitle,
        lead: passkey.secondCancelLead,
        steps: [passkey.secondCancel1, passkey.secondCancel2, passkey.secondCancel3],
        settings: false,
    },
    {
        surface: 'setup-redesign-passkey-took-too-long',
        state: 'took-too-long',
        title: passkey.tookTooLongTitle,
        lead: passkey.tookTooLongLead,
        steps: [],
        settings: false,
    },
    {
        surface: 'setup-redesign-passkey-left-app',
        state: 'left-app',
        title: passkey.leftAppTitle,
        lead: passkey.leftAppLead,
        steps: [],
        settings: false,
    },
    {
        surface: 'setup-redesign-passkey-check-screen-lock',
        state: 'check-screen-lock',
        title: passkey.screenLockTitle,
        lead: passkey.screenLockLead,
        steps: [passkey.screenLock1, passkey.screenLock2, passkey.screenLock3],
        settings: true,
    },
    {
        surface: 'setup-redesign-passkey-check-no-provider',
        state: 'check-no-provider',
        title: passkey.noProviderTitle,
        lead: passkey.noProviderLead,
        steps: [passkey.noProvider1, passkey.noProvider2, passkey.noProvider3],
        settings: true,
    },
]

/** The state of the stage on show (`data-setup-state`), as signup-redesign.spec.ts reads it. */
const stageState = (page: Page) =>
    page.evaluate(() => {
        const slide = Array.from(document.querySelectorAll('[data-setup-slide]')).find(
            (el) => !el.getAttribute('aria-hidden')
        )
        return slide?.querySelector('[data-setup-stage]')?.getAttribute('data-setup-state') ?? null
    })

const footer = (page: Page) => page.locator('[data-setup-footer]')

test.describe('03 Passkey — Android help screens', () => {
    test.use({ viewport: { width: 375, height: 667 } })

    for (const item of CASES) {
        test(`${item.state}: title, lead, steps and buttons`, async ({ page }) => {
            await page.goto(`/dev/surfaces?s=${item.surface}&__fixture=${FIXTURE}`, { waitUntil: 'domcontentloaded' })
            await expect.poll(() => stageState(page), { timeout: 15_000 }).toBe(item.state)

            await expect(page.getByRole('heading', { level: 1 })).toHaveText(item.title)
            await expect(page.getByText(item.lead, { exact: true })).toBeVisible()
            const rows = page.getByTestId('setup-redesign-passkey').getByRole('listitem')
            await expect(rows).toHaveText(item.steps)

            const buttons = footer(page).getByRole('button')
            if (item.settings) {
                await expect(buttons).toHaveText([passkey.openSettings, retry])
                await expect(page.getByTestId('passkey-open-settings')).toBeEnabled()
            } else {
                await expect(buttons).toHaveText([retry])
                await expect(page.getByRole('link', { name: supportLink })).toHaveAttribute(
                    'href',
                    'https://peanut.me/support'
                )
            }
            // A help screen never shows dev's drawer on top.
            await expect(page.getByRole('dialog')).toHaveCount(0)
        })
    }
})

/**
 * Signup, one screenshot per step, for four countries of residence.
 *
 * The residence question is the only branch in signup that depends on an
 * answer the user gives, so the four rows are identical until it and diverge
 * after: Spain, Brazil and the USA are unrestricted, India is on Rain's
 * prohibited-issuance list and gets the card heads-up
 * (constants/residence.consts.ts).
 *
 * Two things make this runnable with no backend:
 *   - the `signed-out` fixture answers GET /users/me with null, so the app
 *     treats the session as absent and runs setup instead of bouncing to /home
 *     on the fixture's own cookie;
 *   - a CDP virtual authenticator stands in for the platform passkey. Without
 *     one, `isUserVerifyingPlatformAuthenticatorAvailable()` is false and
 *     setup stops on the unsupported-browser screen before anything else.
 *
 * Files land as `<flow>-<NN>-<step>@<width>.png` so the row sorts by name.
 */

import { test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { FIXTURE_PARAM } from '../../src/dev/fixtures/active'
import { SIGNUP_USERNAME } from '../../src/dev/fixtures/registry'

const OUT_DIR = process.env.SHOTS_OUT ?? 'e2e/__shots__/current'

const LOADERS = '.animate-spin img[alt="Peanut mascot"], .animate-pulse'

const FREEZE_CSS = `
*, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
}
`

/** The two one-time modals that otherwise cover the home frame. */
function seenOnceModals(): void {
    window.localStorage.setItem('peanut_demo_activation_celebrated_at', '2026-01-01T00:00:00.000Z')
    window.localStorage.setItem(
        'demo-user:user-preferences',
        JSON.stringify({ hasSeenBalanceWarning: { value: true, expiry: 4102444800000 } })
    )
    window.localStorage.setItem('card-pioneer-modal-dismissed', 'true')
}

/** Real-time sleep — page.waitForTimeout runs on the page clock. */
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

async function settle(page: Page): Promise<void> {
    for (let attempt = 0; ; attempt++) {
        try {
            await settleOnce(page)
            return
        } catch (error) {
            if (attempt >= 3) throw error
            await page.waitForLoadState('domcontentloaded').catch(() => {})
            await pause(500)
        }
    }
}

async function settleOnce(page: Page): Promise<void> {
    const inViewport = (box: DOMRect) =>
        box.width > 0 && box.bottom > 0 && box.top < window.innerHeight && box.right > 0 && box.left < window.innerWidth

    await page.waitForFunction(
        (selector) =>
            Array.from(document.querySelectorAll(selector)).every((el) => {
                const box = el.getBoundingClientRect()
                return !(
                    box.width > 0 &&
                    box.bottom > 0 &&
                    box.top < window.innerHeight &&
                    box.right > 0 &&
                    box.left < window.innerWidth
                )
            }),
        LOADERS,
        { polling: 250, timeout: 8_000 }
    )
    await page.addStyleTag({ content: FREEZE_CSS })
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    void inViewport
}

interface Step {
    name: string
    act?: (page: Page) => Promise<void>
}

const tapNext: Step['act'] = async (page) => {
    await page.getByRole('button', { name: /^next$/i }).click()
}

const COUNTRIES = [
    { id: 'spain', label: 'Spain', iso2: 'ES', headsUp: false },
    { id: 'brazil', label: 'Brazil', iso2: 'BR', headsUp: false },
    { id: 'usa', label: 'United States', iso2: 'US', headsUp: false },
    // On Rain's prohibited-issuance list, so Next opens a card heads-up before
    // the passkey step instead of going straight to it.
    { id: 'india', label: 'India', iso2: 'IN', headsUp: true },
] as const

/** Radix Select: click the trigger, then the option in its portal. */
const pickResidence =
    (label: string): Step['act'] =>
    async (page) => {
        // By role, not by the placeholder text: geo prefills the field, so
        // "Select your country" is gone by the time this runs.
        await page.getByRole('combobox').first().click()
        await page.getByRole('option', { name: label, exact: true }).first().click()
        await pause(400)
    }

function stepsFor(country: (typeof COUNTRIES)[number]): Step[] {
    // `?code=` skips the invite step, so the entry screen is the username one.
    return [
        { name: 'username' },
        {
            name: 'residence',
            act: async (page) => {
                await page.getByRole('textbox').first().fill(SIGNUP_USERNAME)
                await pause(600)
                await tapNext!(page)
            },
        },
        { name: 'country-picked', act: pickResidence(country.label) },
        ...(country.headsUp
            ? [
                  { name: 'restriction-heads-up', act: tapNext },
                  {
                      name: 'passkey-offer',
                      act: async (page: Page) => page.getByRole('button', { name: /^continue$/i }).click(),
                  },
              ]
            : [{ name: 'passkey-offer', act: tapNext }]),
        { name: 'passkey-created', act: async (page) => page.getByRole('button', { name: /set it up/i }).click() },
        // The destination, not a continuation of the walk above. The signed-out
        // fixture answers /users/me with null for the whole session, so the app
        // can never see the account it just created and restarts setup instead.
        // Showing where the journey lands needs the `home` fixture, and this
        // frame is labelled as a hand-off rather than a step.
        {
            name: 'home',
            act: async (page) => {
                await page.evaluate(() => window.sessionStorage.clear())
                await page.goto('/home?__fixture=home', { waitUntil: 'domcontentloaded' })
                await pause(2500)
            },
        },
    ]
}

test.describe.configure({ mode: 'serial' })

for (const country of COUNTRIES) {
    test(`signup-${country.id}`, async ({ page, context }, testInfo) => {
        testInfo.setTimeout(180_000)
        const width = testInfo.project.name

        // Stands in for the platform authenticator. Setup gates on one existing
        // before it will show anything but the unsupported-browser screen.
        const cdp = await context.newCDPSession(page)
        await cdp.send('WebAuthn.enable')
        await cdp.send('WebAuthn.addVirtualAuthenticator', {
            options: {
                protocol: 'ctap2',
                transport: 'internal',
                hasResidentKey: true,
                hasUserVerification: true,
                isUserVerified: true,
                automaticPresenceSimulation: true,
            },
        })

        await page.addInitScript(seenOnceModals)

        // Order matters: Playwright checks the LAST registered route first, so
        // the catch-all goes on before the geo stub or it swallows it — which
        // silently removes the prefill this step is meant to show.
        await page.route('**/*', (route) => {
            const { hostname } = new URL(route.request().url())
            return hostname === '127.0.0.1' || hostname === 'localhost' ? route.continue() : route.abort()
        })
        // Pin geo so the residence select opens on the same suggestion on every
        // machine — it prefills from ipapi.co when nothing is chosen yet.
        await page.route('**/ipapi.co/**', (route) => route.fulfill({ status: 200, body: country.iso2 }))

        // `code` skips the invite step, which is not part of what varies here.
        await page.goto(`/setup?${FIXTURE_PARAM}=signed-out&code=peanut`, { waitUntil: 'domcontentloaded' })
        await mkdir(OUT_DIR, { recursive: true })

        for (const [index, step] of stepsFor(country).entries()) {
            if (step.act) await step.act(page)
            await settle(page)
            await page.screenshot({
                path: join(
                    OUT_DIR,
                    `signup-${country.id}-${String(index + 1).padStart(2, '0')}-${step.name}@${width}.png`
                ),
                animations: 'disabled',
                caret: 'hide',
                scale: 'css',
            })
        }
    })
}

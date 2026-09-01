/**
 * KYC journeys, one screenshot per step.
 *
 * fixtures.spec.ts shoots one screen per fixture; this shoots the WALK — the
 * screens a person actually passes through from the home tab to either a
 * deposit form or the wall that stops them. A single screen tells you the
 * gate's verdict, a row of them tells you where in the journey the user finds
 * out, which is the part that turns out to differ between providers.
 *
 * Files land as `<flow>-<NN>-<step>@<width>.png` so the row is sorted by name.
 *
 * Run through playwright.shots.config.ts — see the header there.
 */

import { test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { FIXTURE_PARAM } from '../../src/dev/fixtures/active'

const OUT_DIR = process.env.SHOTS_OUT ?? 'e2e/__shots__/current'

const FROZEN_NOW = new Date('2026-08-15T12:00:00.000Z')

const LOADERS = '.animate-spin img[alt="Peanut mascot"], .animate-pulse'

const FREEZE_CSS = `
*, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
}
`

/**
 * Real-time sleep. NOT page.waitForTimeout: that one runs on the page clock,
 * and page.clock.setFixedTime freezes it, so every waitForTimeout below would
 * hang until the test timeout.
 */
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function seenOnceModals(): void {
    window.localStorage.setItem('peanut_demo_activation_celebrated_at', '2026-01-01T00:00:00.000Z')
    window.localStorage.setItem(
        'demo-user:user-preferences',
        JSON.stringify({ hasSeenBalanceWarning: { value: true, expiry: 4102444800000 } })
    )
    window.localStorage.setItem('card-pioneer-modal-dismissed', 'true')
}

/**
 * Same wait fixtures.spec.ts uses: no in-viewport loader, fonts and images
 * done. Retried, because a journey settles mid-navigation far more often than
 * a single-shot fixture does — the app redirects itself on several of these
 * steps and tears down the execution context under the wait.
 */
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
    await page.waitForFunction(
        (selector) => {
            const { innerHeight, innerWidth } = window
            return Array.from(document.querySelectorAll(selector)).every((el) => {
                const box = el.getBoundingClientRect()
                return (
                    box.width === 0 ||
                    box.bottom <= 0 ||
                    box.top >= innerHeight ||
                    box.right <= 0 ||
                    box.left >= innerWidth
                )
            })
        },
        LOADERS,
        { polling: 250, timeout: 8_000 }
    )
    await page.addStyleTag({ content: FREEZE_CSS })
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    // In-viewport images only. The country list renders ~250 lazy flag images;
    // the off-screen ones never decode, so an every-image check never settles.
    await page.waitForFunction(
        () => {
            const { innerHeight, innerWidth } = window
            return Array.from(document.images).every((img) => {
                const box = img.getBoundingClientRect()
                const offscreen =
                    box.width === 0 ||
                    box.bottom <= 0 ||
                    box.top >= innerHeight ||
                    box.right <= 0 ||
                    box.left >= innerWidth
                return offscreen || img.complete
            })
        },
        null,
        { polling: 250, timeout: 8_000 }
    )
}

/** One captured screen. `act` runs BEFORE the shot; the first step has none. */
interface Step {
    name: string
    act?: (page: Page) => Promise<void>
}

interface Flow {
    /** Also the filename prefix. */
    id: string
    fixture: string
    /** Where the journey starts. */
    entry: string
    steps: Step[]
}

/** Tap "Bank transfer" on the method chooser. */
const chooseBank: Step['act'] = async (page) => {
    await page.getByText('Bank transfer', { exact: true }).click()
}

/** Find a country in the searchable list and open it. */
const pickCountry =
    (name: string): Step['act'] =>
    async (page) => {
        await page.getByRole('textbox').first().fill(name)
        await page.getByText(name, { exact: true }).first().click()
    }

/**
 * Type into the custom amount widget. It has no <input> to fill() and no
 * stable text node to target — the US screen renders "$ 0.00" and the Manteca
 * one "ARS 0.00 / ≈ USD 0.00" — so anchor on the prompt above it and click
 * into the card that always sits directly beneath.
 */
const enterAmount =
    (digits: string): Step['act'] =>
    async (page) => {
        const prompt = page.getByText('How much do you want to add?')
        await prompt.waitFor()
        const box = await prompt.boundingBox()
        if (!box) throw new Error('amount prompt has no box')
        await page.mouse.click(box.x + box.width / 2, box.y + 80)
        await page.keyboard.type(digits)
        await pause(400)
    }

const tapContinue: Step['act'] = async (page) => {
    await page.getByRole('button', { name: /continue/i }).click()
}

const FLOWS: Flow[] = [
    {
        // Baseline: nothing in the way.
        id: 'us-approved',
        fixture: 'kyc-us-approved',
        entry: '/home',
        steps: [
            { name: 'home' },
            { name: 'add-money', act: async (page) => void (await page.goto('/add-money')) },
            { name: 'choose-bank', act: chooseBank },
            { name: 'pick-country', act: pickCountry('United States') },
            { name: 'enter-amount', act: enterAmount('250') },
        ],
    },
    {
        // Same country, one document short.
        id: 'us-needs-poa',
        fixture: 'kyc-us-needs-proof-of-address',
        entry: '/home',
        steps: [
            { name: 'home' },
            { name: 'add-money', act: async (page) => void (await page.goto('/add-money')) },
            { name: 'choose-bank', act: chooseBank },
            { name: 'pick-country', act: pickCountry('United States') },
        ],
    },
    {
        // Verified elsewhere, walks into a jurisdiction they have no rail in.
        id: 'eu-cross-region',
        fixture: 'kyc-eu-cross-region-us',
        entry: '/home',
        steps: [
            { name: 'home' },
            { name: 'add-money', act: async (page) => void (await page.goto('/add-money')) },
            { name: 'choose-bank', act: chooseBank },
            { name: 'pick-country', act: pickCountry('United States') },
        ],
    },
    {
        // The one where the wall arrives late.
        id: 'ar-pool-tier',
        fixture: 'kyc-ar-pool-tier',
        entry: '/home',
        steps: [
            { name: 'home' },
            { name: 'add-money', act: async (page) => void (await page.goto('/add-money')) },
            { name: 'choose-bank', act: chooseBank },
            { name: 'pick-country', act: pickCountry('Argentina') },
            { name: 'enter-amount', act: enterAmount('5000') },
            { name: 'blocked-on-submit', act: tapContinue },
        ],
    },
    {
        // Same applicant as us-needs-poa, but the applicant-action call fails.
        // Reachable in production whenever Sumsub or the token mint is down;
        // it is the only route to the generic error copy.
        id: 'start-action-fails',
        fixture: 'kyc-start-action-fails',
        entry: '/home',
        steps: [
            { name: 'home' },
            { name: 'add-money', act: async (page) => void (await page.goto('/add-money')) },
            { name: 'choose-bank', act: chooseBank },
            { name: 'pick-country', act: pickCountry('United States') },
            { name: 'tap-upload', act: async (page) => page.getByText('Upload document').click() },
        ],
    },
]

// Serial: four journeys of five-plus steps each against one `next start` is
// enough contention that parallel workers time out on settle. Sequential is
// still only ~30s for the set.
test.describe.configure({ mode: 'serial' })

for (const flow of FLOWS) {
    test(flow.id, async ({ page }, testInfo) => {
        // Six screens with a settle each; the single-shot budget is not enough.
        testInfo.setTimeout(150_000)
        const width = testInfo.project.name

        // The country list asks ipapi.co which country to float to the top and
        // renders a pulsing skeleton until it answers. Aborting that request
        // leaves the skeleton up forever, so answer it — with a fixed country,
        // which also keeps the row order identical on every machine.
        await page.route('**/ipapi.co/**', (route) => route.fulfill({ status: 200, body: 'US' }))
        await page.route('**/*', (route) => {
            const { hostname } = new URL(route.request().url())
            return hostname === '127.0.0.1' || hostname === 'localhost' ? route.continue() : route.abort()
        })
        await page.clock.setFixedTime(FROZEN_NOW)
        await page.addInitScript(seenOnceModals)

        await page.goto(`${flow.entry}?${FIXTURE_PARAM}=${flow.fixture}`, { waitUntil: 'domcontentloaded' })
        await mkdir(OUT_DIR, { recursive: true })

        for (const [index, step] of flow.steps.entries()) {
            if (step.act) await step.act(page)
            await settle(page)
            await page.screenshot({
                path: join(OUT_DIR, `${flow.id}-${String(index + 1).padStart(2, '0')}-${step.name}@${width}.png`),
                animations: 'disabled',
                caret: 'hide',
                scale: 'css',
            })
        }
    })
}

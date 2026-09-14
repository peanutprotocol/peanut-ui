/**
 * One PNG per option render in src/dev/surfaces/registry.tsx's OPTION_SURFACES,
 * so an open rework can be decided by eye instead of from a description.
 *
 *   OPTIONS_OUT=e2e/__shots__/options pnpm exec playwright test \
 *     --config=playwright.shots.config.ts --project=375 e2e/shots/options.spec.ts
 */

import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { FIXTURE_STORAGE_KEY } from '../../src/dev/fixtures/active'

const OUT_DIR = process.env.OPTIONS_OUT ?? 'e2e/__shots__/options'
const FIXTURE = 'profile-edit'
const FROZEN_NOW = new Date('2026-08-15T12:00:00.000Z')

const IDS = [
    'opt-passkey-a',
    'opt-passkey-b',
    'opt-passkey-c',
    'opt-passkey-d',
    'opt-onramp-a',
    'opt-onramp-b',
    'opt-onramp-c',
    'opt-onramp-d',
    'opt-kyc-a',
    'opt-kyc-b',
]

const FREEZE_CSS = `
*, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
}
a[href*="__fixture=off"] { display: none !important; }
`

test.describe.configure({ mode: 'parallel' })

for (const id of IDS) {
    test(id, async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 900 })
        await page.route('**/*', (route) => {
            const { hostname } = new URL(route.request().url())
            return hostname === '127.0.0.1' || hostname === 'localhost' ? route.continue() : route.abort()
        })
        await page.clock.setFixedTime(FROZEN_NOW)
        await page.goto(`/dev/surfaces?s=${id}&__fixture=${FIXTURE}`, { waitUntil: 'domcontentloaded' })
        await expect
            .poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), FIXTURE_STORAGE_KEY))
            .toBe(FIXTURE)
        await page.waitForTimeout(600)
        await page.addStyleTag({ content: FREEZE_CSS })
        await page.evaluate(() => document.fonts.ready.then(() => undefined))
        await mkdir(OUT_DIR, { recursive: true })
        await page.screenshot({ path: join(OUT_DIR, `${id}.png`), animations: 'disabled', caret: 'hide', scale: 'css' })
    })
}

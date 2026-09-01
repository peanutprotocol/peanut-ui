/**
 * One interaction shot: the Manteca deposit wall.
 *
 * The `kyc-ar-pool-tier` fixture opens the ARS amount screen even though its
 * bank rail is `requires-info`, which reads at a glance like a missing gate.
 * It is not — MantecaAddMoney gates on submit rather than on entry. This
 * captures the state after Continue so the difference is documented as
 * behaviour rather than as a code reading.
 *
 * Kept out of fixtures.spec.ts because that file is one shot per fixture with
 * no interaction, and the visual-diff script pairs its output by filename.
 */

import { test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { FIXTURE_PARAM } from '../../src/dev/fixtures/active'

const OUT_DIR = process.env.SHOTS_OUT ?? 'e2e/__shots__/current'

test('kyc-ar-pool-tier-submit', async ({ page }, testInfo) => {
    await page.route('**/*', (route) => {
        const { hostname } = new URL(route.request().url())
        return hostname === '127.0.0.1' || hostname === 'localhost' ? route.continue() : route.abort()
    })

    await page.goto(`/add-money/argentina/manteca?${FIXTURE_PARAM}=kyc-ar-pool-tier`, {
        waitUntil: 'domcontentloaded',
    })

    // The amount field is a custom input, not a plain <input type=number> —
    // type into the focused field rather than filling by selector.
    await page.getByText('How much do you want to add?').waitFor()
    // The amount display is a custom widget; focus it by tapping the figure
    // before typing, or the keystrokes go nowhere and Continue stays disabled.
    await page.getByText('0.00').first().click()
    await page.keyboard.type('5000')
    await page.waitForTimeout(400)

    const cta = page.getByRole('button', { name: /continue/i })
    await cta.waitFor()
    await cta.click()

    // The wall is a modal; wait for its copy rather than a fixed delay.
    await page
        .getByText(/verify|unlock|document|CUIT/i)
        .first()
        .waitFor({ timeout: 15_000 })
    await page.waitForTimeout(600)

    await mkdir(OUT_DIR, { recursive: true })
    await page.screenshot({
        path: join(OUT_DIR, `kyc-ar-pool-tier-submit@${testInfo.project.name}.png`),
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
    })
})

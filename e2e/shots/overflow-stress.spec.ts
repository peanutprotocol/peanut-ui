/**
 * Stress gate (TASK-23132): every fixture again, but hostile.
 *
 *  - stress-* projects open each fixture with stress mode on
 *    (src/dev/fixtures/stress.ts): long and unusual names, 254-char emails,
 *    280-char memos, huge and tiny amounts, 50-row lists.
 *  - large-text-* projects open each fixture with the root font size at 150%
 *    and 200%, like a phone with large system text.
 *
 * Each screen must render without an uncaught page error, without the app's
 * crash screen, and without clipped copy or horizontal page scroll
 * (findOverflows). Advisory until it has a clean week, like the overflow gate.
 *
 *   npm run test:stress:run
 */

import { expect, test } from '@playwright/test'
import { FIXTURES } from '../../src/dev/fixtures/registry'
import { STRESS_STORAGE_KEY } from '../../src/dev/fixtures/stress'
import { openFixture } from './fixture-page'
import { EXEMPT, findOverflows } from './overflow-check'

const CRASH_COPY = /Application error|client-side exception/i

test.describe.configure({ mode: 'parallel' })

for (const name of Object.keys(FIXTURES)) {
    test(`fixture:${name}`, async ({ page }, testInfo) => {
        // large-text opens the fixture once and re-checks it at each root font size
        const { stress, rootFontSizes } = testInfo.project.metadata as { stress?: boolean; rootFontSizes?: string[] }
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))

        if (stress) await page.addInitScript((key) => window.sessionStorage.setItem(key, '1'), STRESS_STORAGE_KEY)
        await openFixture(page, name, testInfo.project.use.locale)

        for (const rootFontSize of rootFontSizes ?? [undefined]) {
            const label = rootFontSize ? `${name} at ${rootFontSize}` : name
            if (rootFontSize) {
                await page.evaluate((size) => {
                    let style = document.getElementById('stress-font-size')
                    if (!style) {
                        style = document.createElement('style')
                        style.id = 'stress-font-size'
                        document.head.appendChild(style)
                    }
                    style.textContent = `html { font-size: ${size} !important; }`
                }, rootFontSize)
                await page.waitForTimeout(300)
            }

            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
            await page.waitForTimeout(300)
            await page.evaluate(() => window.scrollTo(0, 0))

            const text = await page.evaluate(() => document.body.innerText.trim())
            // a long value the user can edit scrolls inside its input, so only
            // read-only values and placeholders count as cut copy here
            const editableValues = await page.evaluate(() =>
                Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'))
                    .filter((el) => el.value && !el.readOnly && !el.disabled)
                    .map((el) => el.value.trim())
            )
            const overflows = (await page.evaluate(findOverflows, EXEMPT)).filter(
                (o) => !(o.kind === 'placeholder' && editableValues.includes(o.text))
            )
            if (overflows.length > 0 || errors.length > 0) {
                await testInfo.attach(`${label}-stress`, {
                    body: await page.screenshot({ fullPage: true }),
                    contentType: 'image/png',
                })
            }

            expect.soft(errors, `uncaught page errors on ${label}`).toEqual([])
            // next.js crash screen only; fixtures may show the app's own error state on purpose
            expect.soft(text, `${label} rendered the crash screen`).not.toMatch(CRASH_COPY)
            expect.soft(text.length, `${label} rendered a blank page`).toBeGreaterThan(0)
            const report = overflows.map((o) => `[${o.kind}] ${o.selector} — “${o.text}” (${o.detail})`).join('\n')
            expect.soft(overflows, `clipped copy on ${label}:\n${report}`).toEqual([])
        }
    })
}

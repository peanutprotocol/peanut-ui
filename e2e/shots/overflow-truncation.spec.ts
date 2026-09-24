/**
 * Cut-copy gate: the home drawers and the Send picker at 375px, in every app
 * locale, fail when any text in them is cut short — clipped, or ellipsized.
 *
 * The i18n overflow gate (overflow.spec.ts) skips deliberate truncation, since
 * addresses and usernames truncate by design, and the word-count lint never
 * renders anything. Neither could see "Withdraw to your own accou…" in the
 * home Send drawer (QA 2026-09-24). On these screens every row is a choice the
 * user reads before tapping, so nothing may be cut.
 *
 * The other side of the rule: a title that is data (an address, a bank name,
 * a person's name) truncates to ONE line instead of stacking three. The
 * DATA_TITLES fixtures pin that.
 *
 *   npm run test:i18n-overflow:run -- --project='truncation*'
 */

import { expect, test } from '@playwright/test'
import { openFixture } from './fixture-page'
import { findOverflows, findTruncations } from './overflow-check'

/** fixture → the part of the page whose copy must never be cut */
const SCREENS: Record<string, string> = {
    'home-add-drawer': '[role="dialog"]',
    'home-send-drawer': '[role="dialog"]',
    'home-request-drawer': '[role="dialog"]',
    send: 'body',
}

test.describe.configure({ mode: 'parallel' })

for (const [name, scope] of Object.entries(SCREENS)) {
    test(`fixture:${name}`, async ({ page }, testInfo) => {
        await openFixture(page, name, testInfo.project.use.locale)
        await expect(page.locator(scope).first()).toBeVisible()

        const cut = [...(await page.evaluate(findTruncations, scope)), ...(await page.evaluate(findOverflows, []))]
        const report = cut.map((o) => `[${o.kind}] ${o.selector} — “${o.text}” (${o.detail})`).join('\n')
        expect(cut, `cut ${testInfo.project.name} copy on ${name}:\n${report}`).toEqual([])
    })
}

/** fixture → data titles that must render cut, on one line */
const DATA_TITLES: Record<string, string[]> = {
    'withdraw-long-destination-names': [
        'Sistema de Transferencias y Pagos STP, S.A. de C.V., SOFOM E.N.R. · 2890',
        '0x28c6c06298d514db089934071355e5743bf21d60',
    ],
    'send-contacts-long-names': ['Maximiliano Alejandro Fernández de la Vega y Santibáñez'],
}

for (const [name, titles] of Object.entries(DATA_TITLES)) {
    test(`data titles stay on one line: ${name}`, async ({ page }, testInfo) => {
        await openFixture(page, name, testInfo.project.use.locale)
        for (const text of titles) {
            const title = page.getByText(text, { exact: true }).first()
            await expect(title).toBeVisible()
            const box = await title.evaluate((el) => ({
                lines: el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight),
                cut: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 3,
            }))
            expect(box.cut, `"${text}" should be long enough to cut at 375px`).toBe(true)
            expect(box.lines, `"${text}" should stay on one line`).toBeLessThan(1.5)
        }
    })
}

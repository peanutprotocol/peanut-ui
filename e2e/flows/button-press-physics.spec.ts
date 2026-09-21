/**
 * Button press physics — the DS contract the CSS keeps breaking.
 *
 * The press state translates the button 4px down-right so it drops INTO its
 * own offset shadow. That only works while the shadow is still there, and
 * `.btn-primary` used to clear it on :hover — which on desktop is always true
 * at the moment of a click, so the button jumped into nothing. A class-name
 * unit test cannot see this: the bug lives in which state wins in the
 * cascade, so it has to be read off computed style in a real browser.
 *
 * /pricing is the target because it renders a real primary and a real stroke
 * Button and needs no backend. The /dev/ds button page would be the obvious
 * home, but every /dev route sits behind a session gate that never resolves
 * in this harness, so the page stays on "Loading...".
 *
 * Run: NEXT_PUBLIC_VERCEL_ENV=preview npm run build && npm run test:e2e:regression
 */

import { expect, test, type Locator, type Page } from '@playwright/test'

// a Button in shadow mode. Raw `btn btn-primary` markup on marketing pages
// carries the look but not the press classes, so it is not this contract.
const pressable = (page: Page, variant: string) => page.locator(`.${variant}[class*="active:translate-x-1"]`).first()

// tailwind v4 writes the press offset to the `translate` property, not to
// `transform` — reading `transform` reports "none" and passes on a broken button
const translate = (el: Locator) => el.evaluate((n) => getComputedStyle(n).translate)
const boxShadow = (el: Locator) => el.evaluate((n) => getComputedStyle(n).boxShadow)
const background = (el: Locator) => el.evaluate((n) => getComputedStyle(n).backgroundColor)

/** hold the real :active state open while the assertions run */
async function press(el: Locator) {
    // hover() runs the actionability checks, so the press lands on the button
    // and not on a sticky bar that happens to cover its centre point
    await el.hover()
    await el.page().mouse.down()
}

test.describe('Button press physics', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/pricing', { waitUntil: 'domcontentloaded' })
    })

    test('primary keeps its shadow on hover and drops into it on press', async ({ page }) => {
        const primary = pressable(page, 'btn-primary')
        await expect(primary).toBeVisible()

        // 4px 4px 0 black — no blur, no spread: the offset shadow
        const rest = await boxShadow(primary)
        expect(rest).toContain('rgb(0, 0, 0) 4px 4px 0px')

        await primary.hover()
        expect(await boxShadow(primary), 'the shadow must survive hover').toBe(rest)

        await press(primary)
        try {
            // the press state transitions, so poll until it settles
            await expect.poll(() => translate(primary), { message: 'press moves 4px into the shadow' }).toBe('4px 4px')
            expect(await boxShadow(primary), 'the shadow the button lands on is cleared').not.toContain(
                'rgb(0, 0, 0) 4px 4px 0px'
            )
        } finally {
            await page.mouse.up()
        }
    })

    test('stroke stays white while pressed', async ({ page }) => {
        const stroke = pressable(page, 'btn-stroke')
        await expect(stroke).toBeVisible()

        const rest = await background(stroke)
        expect(rest).toBe('rgb(255, 255, 255)')

        await press(stroke)
        try {
            await expect.poll(() => translate(stroke), { message: 'press moves 4px into the shadow' }).toBe('4px 4px')
            expect(await background(stroke), 'the secondary button must not flash a fill on press').toBe(rest)
        } finally {
            await page.mouse.up()
        }
    })
})

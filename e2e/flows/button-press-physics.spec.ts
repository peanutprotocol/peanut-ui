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
 * /shhhhh is the target because it renders a real primary and a real stroke
 * Button with no caller overrides, and needs no backend. The /dev/ds button
 * page would be the obvious home, but every /dev route sits behind a session
 * gate that never resolves in this harness, so it stays on "Loading...".
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
        await page.goto('/shhhhh', { waitUntil: 'domcontentloaded' })
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

    test('the nav circle changes fill from hover to press, and never drops', async ({ page }) => {
        // nav board 17802:61534 draws this as a ring on the page background —
        // the ghost icon-only button. A shadow here would make the top nav
        // move 4px under the thumb, which is not a navigation gesture.
        const back = page.getByTestId('nav-back')
        await expect(back).toBeVisible()
        expect(await boxShadow(back)).toBe('none')

        // the press fill has to DIFFER from the hover fill. A pointer is always
        // hovering when it clicks, so one colour for both is no press state at
        // all — and a test that hovers first would pass with :active deleted.
        await back.hover()
        const hovered = await background(back)

        await press(back)
        try {
            // design.md law 7: ghost presses to action-ghost-hover (#bd33a1)
            await expect
                .poll(() => background(back), { message: 'press fill is action-ghost-hover' })
                .toBe('rgb(189, 51, 161)')
            expect(await background(back), 'press must not look like hover').not.toBe(hovered)
            expect(await translate(back), 'a shadowless control must not translate').toBe('none')
        } finally {
            await page.mouse.up()
        }
    })

    test('stroke turns brand pink while pressed', async ({ page }) => {
        const stroke = pressable(page, 'btn-stroke')
        await expect(stroke).toBeVisible()

        expect(await background(stroke), 'white at rest').toBe('rgb(255, 255, 255)')

        // stroke has no hover fill, so the pink below can only come from :active
        await stroke.hover()
        expect(await background(stroke), 'still white on hover').toBe('rgb(255, 255, 255)')

        await press(stroke)
        try {
            await expect.poll(() => translate(stroke), { message: 'press moves 4px into the shadow' }).toBe('4px 4px')
            // states board 17308:13973 — pink is the pressed fill, action/primary
            await expect
                .poll(() => background(stroke), { message: 'pressed fill is the brand pink' })
                .toBe('rgb(255, 144, 232)')
        } finally {
            await page.mouse.up()
        }
    })
})

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

/** how long the finger stays down — the assertions under it take ~300ms */
const TOUCH_HOLD_MS = 5_000

/**
 * hold a real finger on the element, and give back the lift.
 *
 * `press()` above is no guard for a control whose hover fill and press fill are
 * the same colour: a pointer has to hover the button to click it, so the hover
 * fill alone would satisfy the assertion and deleting the `active:` class would
 * keep it green. It survives today only because the config runs an `isMobile`
 * device, so Chromium re-emits the mouse as touch and no :hover is ever set —
 * luck, from one line in the config, not a guarantee. A finger brings no hover
 * with it by construction, so the fill it produces can only be :active.
 *
 * It has to be a synthesized GESTURE. Playwright's touchscreen taps and lets go
 * in one call, and raw `Input.dispatchTouchEvent` delivers a touchstart the page
 * can see but never reaches Chromium's gesture recognizer — so :active never
 * turns on. `Input.synthesizeTapGesture` does, and its `duration` is the hold.
 * The config already runs a `hasTouch` device (Pixel 7), so touch is available
 * without a context of its own.
 */
async function touchPress(el: Locator) {
    const page = el.page()
    await el.scrollIntoViewIfNeeded()
    const box = await el.boundingBox()
    if (!box) throw new Error('nothing to press: the element has no box')

    const x = box.x + box.width / 2
    const y = box.y + box.height / 2

    // the gesture goes to raw viewport coordinates and gets none of the
    // actionability checks `press()` borrows from hover(). A sticky bar over
    // the centre point would swallow the tap, :active would never set, and the
    // poll under the press would time out on CSS that is correct — so hit-test
    // the point first and name whatever is in the way.
    const intruder = await el.evaluate(
        (node, point) => {
            const hit = document.elementFromPoint(point.x, point.y)
            if (!hit) return 'nothing — the point is outside the viewport'
            if (hit === node || node.contains(hit)) return null
            return `<${hit.tagName.toLowerCase()} class="${hit.getAttribute('class') ?? ''}">`
        },
        { x, y }
    )
    if (intruder) throw new Error(`the tap point (${x}, ${y}) is covered by ${intruder}, not by the element to press`)

    const cdp = await page.context().newCDPSession(page)
    const lifted = cdp.send('Input.synthesizeTapGesture', {
        x,
        y,
        duration: TOUCH_HOLD_MS,
        gestureSourceType: 'touch',
    })

    return async () => {
        await lifted
        await cdp.detach()
    }
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

    test('the nav circle fills pink on press, and never drops', async ({ page }) => {
        // nav board 17802:61534 draws this as a ring on the page background —
        // the ghost icon-only button. A shadow here would make the top nav
        // move 4px under the thumb, which is not a navigation gesture.
        const back = page.getByTestId('nav-back')
        await expect(back).toBeVisible()
        expect(await boxShadow(back)).toBe('none')

        // the board (17308:13973) draws ONE colour, action-primary pink, for
        // hover AND press (kush ruling 2026-09-21 — a two-colour press shipped
        // briefly and read as a purple back button). One colour for both states
        // is what makes a mouse press unable to prove anything here, so the
        // press below is a real touch: the circle is transparent at rest and a
        // finger brings no hover with it, so the pink can only be :active.
        expect(await background(back), 'transparent at rest').toBe('rgba(0, 0, 0, 0)')

        const release = await touchPress(back)
        try {
            await expect
                .poll(() => background(back), { message: 'press fill is action-primary' })
                .toBe('rgb(255, 144, 232)')
            expect(await translate(back), 'a shadowless control must not translate').toBe('none')
        } finally {
            await release()
        }
    })

    // /shhhhh's back circle is the NavHeader one. The setup flow builds its own
    // navigation row, and its circles were the last call site still drawing a
    // stroke button with the shadow stripped — a white chip on the #90a8ed
    // hero, which is the state the board does not have (kush QA 2026-09-21).
    // /setup/finish renders that row with no backend and no login.
    test('the setup nav circle is a ring on the hero, not a white chip', async ({ page }) => {
        await page.goto('/setup/finish', { waitUntil: 'domcontentloaded' })

        const circle = page.getByRole('button', { name: 'Logout' })
        await expect(circle).toBeVisible()

        expect(await background(circle), 'transparent at rest').toBe('rgba(0, 0, 0, 0)')
        expect(await boxShadow(circle), 'a nav circle carries no shadow').toBe('none')

        // same const, same one-colour contract as the circle above, so the same
        // touch press — a mouse could not tell the hover fill from the press one
        const release = await touchPress(circle)
        try {
            await expect
                .poll(() => background(circle), { message: 'press fill is action-primary' })
                .toBe('rgb(255, 144, 232)')
            expect(await translate(circle), 'a shadowless control must not translate').toBe('none')
        } finally {
            await release()
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

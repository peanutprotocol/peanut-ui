import { expect, test, type Locator, type Page } from '@playwright/test'
import { FIXTURE_STORAGE_KEY, fixtureHref } from '../../src/dev/fixtures/active'

// approved input focus: the same blue ring for pointer and keyboard.
// literal values are intentional: changing the css token must not update the expectation.
const FOCUS = {
    outlineColor: 'rgb(37, 99, 235)',
    outlineStyle: 'solid',
    outlineWidth: '3px',
    borderColor: 'rgba(0, 0, 0, 0)',
    boxShadow: 'none',
}

const fields = [
    {
        name: 'BaseInput',
        route: '/dev/ds/primitives/base-input',
        input: 'input[placeholder="medium (md) — default"]',
        chrome: 'input[placeholder="medium (md) — default"]',
    },
    {
        name: 'ValidatedInput',
        route: '/send?view=contacts',
        input: '[data-input-container] input',
        chrome: '[data-input-container]',
    },
    {
        name: 'AmountInput',
        route: '/send?view=link',
        input: 'input[inputmode="decimal"]',
        chrome: 'form:has(input[inputmode="decimal"])',
    },
]

async function readFocus(chrome: Locator) {
    return chrome.evaluate((element) => {
        const style = getComputedStyle(element)
        return {
            outlineColor: style.outlineColor,
            outlineStyle: style.outlineStyle,
            outlineWidth: style.outlineWidth,
            borderColor: style.borderColor,
            boxShadow: style.boxShadow,
        }
    })
}

async function expectFocus(chrome: Locator, timeout = 10_000) {
    await expect.poll(() => readFocus(chrome), { timeout }).toEqual(FOCUS)
}

async function open(page: Page, route: string) {
    const response = await page.goto(fixtureHref(route, 'home'), { waitUntil: 'domcontentloaded' })
    expect(response?.ok(), 'the fixture route must load').toBe(true)
    await expect.poll(() => page.evaluate((key) => sessionStorage.getItem(key), FIXTURE_STORAGE_KEY)).toBe('home')
}

test.beforeEach(async ({ page, baseURL }) => {
    // these are fixture-only rendering checks; no analytics, rpc or live api.
    await page.route('**/*', (route) =>
        new URL(route.request().url()).origin === new URL(baseURL!).origin ? route.continue() : route.abort()
    )
})

for (const mode of ['mouse', 'touch', 'keyboard'] as const) {
    test.describe(mode, () => {
        test.use({ isMobile: mode === 'touch', hasTouch: mode === 'touch', viewport: { width: 375, height: 667 } })

        for (const field of fields) {
            test(`${field.name} keeps the blue focus ring`, async ({ page }) => {
                await open(page, field.route)
                const input = page.locator(field.input)
                const chrome = page.locator(field.chrome)
                await expect(input).toBeVisible()
                // keep the old selector's precondition reachable, even though its provider was deleted.
                await page.evaluate(
                    (value) => {
                        document.documentElement.dataset.inputModality = value
                    },
                    mode === 'keyboard' ? 'keyboard' : 'pointer'
                )

                if (mode === 'keyboard') {
                    // seed the tab position, then enter through a real keyboard event.
                    await input.focus()
                    await page.keyboard.press('Shift+Tab')
                    await expect(input).not.toBeFocused()
                    await page.keyboard.press('Tab')
                } else if (mode === 'touch') {
                    await input.tap()
                } else {
                    await input.click()
                }

                await expect(input).toBeFocused()
                await expectFocus(chrome)
                if (field.name !== 'BaseInput') {
                    // the wrapper owns the ring; the inner control must not draw a second one.
                    await expect(input).toHaveCSS('outline-style', 'none')
                    await expect(input).toHaveCSS('box-shadow', 'none')
                }
            })
        }
    })
}

// the ui#3041 / fc2c1a732 selectors, replayed only in this browser page.
const PINK_POINTER_RULE = `
    :root[data-input-modality='pointer'] .input:focus,
    :root[data-input-modality='pointer'] [data-input-container]:focus-within {
        border-color: var(--color-action-primary);
        outline: none;
    }
`

// the historical selectors never matched the AmountInput form.
for (const field of fields.filter((field) => field.name !== 'AmountInput')) {
    test(`${field.name} rejects the historical pink pointer rule`, async ({ page }) => {
        await open(page, field.route)
        const input = page.locator(field.input)
        const chrome = page.locator(field.chrome)
        await input.click()
        await expect(input).toBeFocused()
        await expectFocus(chrome)
        await page.evaluate(() => {
            document.documentElement.dataset.inputModality = 'pointer'
        })
        const mutation = await page.addStyleTag({ content: PINK_POINTER_RULE })
        try {
            await expect(chrome).toHaveCSS('border-color', 'rgb(255, 144, 232)')
            await expect(chrome).toHaveCSS('outline-style', 'none')
            // use the exact same assertion as the positive cases, not a second detector.
            await expect(expectFocus(chrome, 250)).rejects.toThrow()
        } finally {
            await mutation.evaluate((element) => element.parentNode?.removeChild(element))
        }
        await expectFocus(chrome)
    })
}

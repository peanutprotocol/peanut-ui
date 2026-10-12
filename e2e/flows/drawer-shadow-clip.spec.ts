/**
 * Drawers and modals — no button shadow may be clipped (TASK-23054).
 *
 * A primary CTA at the end of a drawer sits flush with the bottom edge of the
 * sheet's scroll box. That box is overflow:auto, so it cut the CTA's 4px offset
 * shadow off in a straight line ("Update residence" on the Accounts page). The
 * fix lives once in src/components/Global/Drawer; this sweep keeps every sheet
 * and modal honest, including ones added later: it walks every surface on
 * /dev/surfaces, the fixture routes that open a drawer, and the drawers that
 * open from a tap.
 *
 * Only buttons inside the open dialog are judged. While a drawer is open vaul
 * scales and clips the page behind it, which is not this bug.
 *
 *   NEXT_PUBLIC_VERCEL_ENV=preview npm run build
 *   npm run test:e2e:regression -- drawer-shadow-clip
 */

import { expect, test, type Page } from '@playwright/test'
import { FIXTURE_STORAGE_KEY } from '../../src/dev/fixtures/active'
import { SURFACE_META } from '../../src/dev/surfaces/list'
import { collectShadowClips } from '../utils/shadow-clip'

// Any fixture engages fixture mode; the demo baseline is a verified user.
const DEFAULT_FIXTURE = 'profile-edit'

const DIALOG = '[role="dialog"], [role="alertdialog"]'

// Open instantly: a sheet measured mid-slide has its button off screen.
const NO_MOTION = `*, *::before, *::after { animation: none !important; transition: none !important; }`

type Case = {
    name: string
    url: string
    fixture: string
    /** opens the dialog after load */
    open?: (page: Page) => Promise<void>
}

const SURFACE_CASES: Case[] = Object.entries(SURFACE_META)
    .filter(([, surface]) => !surface.blocked)
    .map(([id, surface]) => {
        const fixture = surface.shotFixture ?? DEFAULT_FIXTURE
        const { shotClick, shotClickTestId } = surface
        return {
            name: `surface ${id}`,
            url: `/dev/surfaces?s=${id}&__fixture=${fixture}`,
            fixture,
            open:
                shotClick || shotClickTestId
                    ? (page: Page) =>
                          (shotClickTestId
                              ? page.getByTestId(shotClickTestId)
                              : page.getByRole('button', { name: shotClick })
                          ).click()
                    : undefined,
        }
    })

const fixtureCase = (fixture: string, route: string, open?: Case['open']): Case => ({
    name: `fixture ${fixture}`,
    url: `${route}${route.includes('?') ? '&' : '?'}__fixture=${fixture}`,
    fixture,
    open,
})

// Drawers that open from a route or a tap rather than from /dev/surfaces.
const tap = (testId: string) => (page: Page) => page.getByTestId(testId).click()

const FLOW_CASES: Case[] = [
    fixtureCase('home-send-drawer', '/home?drawer=send'),
    fixtureCase('home-add-drawer', '/home?drawer=add'),
    fixtureCase('home-request-drawer', '/home?drawer=request'),
    // the reported case: "Residence required" (ClosedRowDrawer) and its sibling
    // sheets on the same list
    { ...fixtureCase('profile-accounts', '/profile/accounts', tap('bank-row-ars')), name: 'closed row ARS' },
    { ...fixtureCase('profile-accounts', '/profile/accounts', tap('bank-row-brl')), name: 'unlock row BRL' },
    { ...fixtureCase('profile-accounts', '/profile/accounts', tap('bank-row-usd')), name: 'unlock row USD' },
    { ...fixtureCase('get-paid', '/add-money?method=bank', tap('bank-row-ars')), name: 'add money closed row ARS' },
    {
        ...fixtureCase('get-paid-blocked', '/add-money?method=bank', tap('deposit-account-SEPA_EU')),
        name: 'corridor gate EUR',
    },
]

// The high-balance warning and the "You're unlocked" celebration open
// themselves on a first visit and would cover the dialog under test.
function seenOnceModals(): void {
    window.sessionStorage.setItem('showNoMoreJailModal', 'true')
    window.localStorage.setItem('peanut_demo_activation_celebrated_at', '2026-01-01T00:00:00.000Z')
    window.localStorage.setItem(
        'demo-user:user-preferences',
        JSON.stringify({ hasSeenBalanceWarning: { value: true, expiry: 4102444800000 } })
    )
}

test.describe.configure({ mode: 'parallel' })

for (const c of [...SURFACE_CASES, ...FLOW_CASES]) {
    test(`${c.name} keeps its button shadows at 375x667`, async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 })
        await page.route('**/*', (route) => {
            const { hostname } = new URL(route.request().url())
            return hostname === '127.0.0.1' || hostname === 'localhost' ? route.continue() : route.abort()
        })
        await page.addInitScript(seenOnceModals)
        await page.addInitScript((css) => {
            document.addEventListener('DOMContentLoaded', () => {
                const style = document.createElement('style')
                style.textContent = css
                document.head.appendChild(style)
            })
        }, NO_MOTION)

        await page.goto(c.url, { waitUntil: 'domcontentloaded' })
        await expect
            .poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), FIXTURE_STORAGE_KEY), {
                message: 'fixture mode never engaged — is this a NEXT_PUBLIC_VERCEL_ENV=preview build?',
            })
            .toBe(c.fixture)

        if (c.open) {
            await c.open(page)
            await expect(page.locator(DIALOG).first()).toBeVisible()
        }
        // portals mount a frame after open, and fonts move the layout once
        await page.waitForTimeout(600)
        await page.evaluate(() => document.fonts.ready.then(() => undefined))

        // A surface that is a full screen rather than a dialog is judged whole.
        const scope = (await page.locator(DIALOG).count()) > 0 ? DIALOG : undefined
        // The CTA usually ends the sheet. Scroll every scroll box in it to the
        // end, where the CTA and its whole shadow must be on screen; mid-scroll
        // the window edge crops content on purpose.
        if (scope) {
            await page.evaluate((selector) => {
                for (const root of Array.from(document.querySelectorAll(selector))) {
                    for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
                        if (el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight
                    }
                }
            }, scope)
        }
        const offenders = await page.evaluate(collectShadowClips, { scope, viewportClips: !!scope })

        const report = offenders
            .map((o) => `    ${o.button}\n    clipped by ${o.clippedBy} (over ${o.overflowBy})`)
            .join('\n')
        expect(offenders, `button shadows clipped on ${c.url}:\n${report}`).toEqual([])
    })
}

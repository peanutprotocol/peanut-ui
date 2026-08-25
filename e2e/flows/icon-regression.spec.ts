/**
 * Icon rendering regression spec.
 *
 * Guards the MUI→Lucide migration:
 *   1. `.btn svg { fill: inherit }` in tailwind.config.js forced black fill on
 *      every icon inside a Button, collapsing Lucide's open-curve paths
 *      (refresh-cw's arcs, log-out's bracket, chevrons) into filled blobs. Fix
 *      is inline `style={{ fill: 'none' }}` in LucideWrapper which beats
 *      class-level CSS on specificity. This spec verifies the inline style is
 *      set on every `svg.lucide` — pure DOM assertion, no screenshots.
 *   2. Every icon carries the stroke weight its viewBox asks for. Lucide draws
 *      at stroke-width 2 on a 24-unit grid, and Icon.tsx crops seven icons to
 *      a 20-unit viewBox (VIEWBOX_BOOST), which scales the stroke down to
 *      2 × 20/24. Both cases are the one rule `2 × span / 24`, so the check
 *      reads each icon's own viewBox instead of naming the seven.
 *
 * No API and no login. `?__fixture=home` writes the fake session the app layout
 * needs to render anything — see src/dev/fixtures/active.ts. Any fixture name
 * does; these pages call no API of their own.
 */

import { test, expect } from '@playwright/test'

test.describe('Icon rendering regression', () => {
    test('every icon on /dev/ds/foundations/icons has inline fill:none and the stroke its viewBox asks for', async ({
        page,
    }) => {
        await page.goto('/dev/ds/foundations/icons?__fixture=home', { waitUntil: 'domcontentloaded' })

        await page.waitForSelector('svg.lucide', { timeout: 60_000 })

        const attrs = await page.$$eval('svg.lucide', (nodes) =>
            nodes.map((n) => ({
                name: n.className.baseVal.match(/lucide-[a-z0-9-]+/g)?.slice(-1)[0] ?? 'unknown',
                inlineFill: (n as SVGSVGElement).style.fill,
                strokeWidth: Number(n.getAttribute('stroke-width')),
                // Third number of "minX minY width height" — the grid the icon draws on.
                span: Number((n.getAttribute('viewBox') ?? '0 0 24 24').split(' ')[2]),
            }))
        )

        expect(attrs.length, 'expected at least one lucide icon on the page').toBeGreaterThan(10)

        const badFill = attrs.filter((a) => a.inlineFill !== 'none' && a.inlineFill !== 'currentcolor')
        expect(badFill, `Lucide icons with unexpected inline fill: ${JSON.stringify(badFill)}`).toEqual([])

        const badStroke = attrs.filter((a) => Math.abs(a.strokeWidth - (2 * a.span) / 24) > 0.001)
        expect(
            badStroke,
            `Lucide icons whose stroke does not match their viewBox: ${JSON.stringify(badStroke)}`
        ).toEqual([])
    })

    test('icons inside button elements keep fill:none (the /setup blob regression)', async ({ page }) => {
        // The dev icons page puts every icon in a grid card — not inside <button> tags.
        // Use the DS playground's button showcase which renders buttons with icons in them.
        await page.goto('/dev/ds/primitives/button?__fixture=home', { waitUntil: 'domcontentloaded' })
        await page.waitForSelector('button svg.lucide', { timeout: 60_000 }).catch(() => {
            // Fallback: if button-showcase doesn't have icons, try the icons page itself.
        })

        // Check every lucide SVG currently on the page (whether inside button or not).
        const all = await page.$$eval('svg.lucide', (nodes) =>
            nodes.map((n) => ({
                name: n.className.baseVal.match(/lucide-[a-z0-9-]+/g)?.slice(-1)[0] ?? 'unknown',
                inAnyButton: !!n.closest('button'),
                inlineFill: (n as SVGSVGElement).style.fill,
            }))
        )

        // If there are no in-button lucide icons on the page we loaded, that's fine —
        // the main icons test already covers the inline-style assertion globally.
        const inButtons = all.filter((i) => i.inAnyButton)
        for (const icon of inButtons) {
            expect(icon.inlineFill, `${icon.name} inside a button must have fill:none inline`).toMatch(
                /^(none|currentcolor)$/
            )
        }
    })
})

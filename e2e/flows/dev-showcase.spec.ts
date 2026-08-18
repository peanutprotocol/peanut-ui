/**
 * Dev routes — the /dev/ds design-system showcase.
 *
 * These are the CRITICAL snapshots for M2. When we kill MUI, flow contexts,
 * or Redux, the design system showcase should still render identically.
 *
 * The /dev/ds doc-site pages render every Bruddle primitive + Global
 * component with every variant — the canonical regression target. The sweep
 * below walks every doc page from the showcase's own nav config, so new
 * pages join the regression net automatically.
 */

import { expect, test } from '@playwright/test'
import { captureStep, collectConsoleLogs } from '../utils/capture'
import { dismissModals } from '../utils/dismiss-modals'
// type-only IconName import inside nav-config is erased at runtime, so this is safe to import here
import { SIDEBAR_CONFIG, TIERS } from '../../src/app/(mobile-ui)/dev/ds/_components/nav-config'

// tier indexes + every doc page; playground sub-items live under /dev (standalone harnesses), not /dev/ds
const DS_DOC_ROUTES = [...TIERS, ...Object.values(SIDEBAR_CONFIG).flat()]
    .map((item) => item.href)
    .filter((href) => href.startsWith('/dev/ds'))

test.describe('Dev showcase (design system)', () => {
    test('/dev — root dev page', async ({ page }, testInfo) => {
        const c = collectConsoleLogs(page)
        const res = await page.goto('/dev', { waitUntil: 'domcontentloaded' })
        expect(res?.ok(), '/dev responded non-2xx').toBeTruthy()
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-dev-root' })
        c.flush(testInfo, 'dev-root')
    })

    test('/dev/ds — design system root', async ({ page }, testInfo) => {
        const c = collectConsoleLogs(page)
        const res = await page.goto('/dev/ds', { waitUntil: 'domcontentloaded' })
        expect(res?.ok(), '/dev/ds responded non-2xx').toBeTruthy()
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-ds-root' })
        await page.waitForTimeout(1500)
        await captureStep(page, testInfo, { name: '02-ds-root-settled' })
        c.flush(testInfo, 'ds-root')
    })

    test('/dev/ds doc pages — full component sweep', async ({ page }, testInfo) => {
        const c = collectConsoleLogs(page)
        for (const route of DS_DOC_ROUTES) {
            const res = await page.goto(route, { waitUntil: 'domcontentloaded' })
            expect(res?.ok(), `${route} responded non-2xx`).toBeTruthy()
            await dismissModals(page)
            await page.waitForTimeout(800)
            await captureStep(page, testInfo, { name: route.replace('/dev/ds', 'ds').replaceAll('/', '-') })
        }
        c.flush(testInfo, 'ds-doc-sweep')
    })
})

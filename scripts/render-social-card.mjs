#!/usr/bin/env node
// Re-makes the default link-preview card, public/metadata-img.png.
//
// The card is the /dev/social-card page; this opens it in a 1200 x 630 window
// and saves the screenshot as it is. Nothing is drawn or composited here.
//
//   pnpm dev                                  # in another shell
//   node scripts/render-social-card.mjs       # writes public/metadata-img.png
//
// Flags: --base <url> (default http://localhost:3000), --out <file>.
import { parseArgs } from 'node:util'
import { chromium } from '@playwright/test'

const { values } = parseArgs({
    options: {
        base: { type: 'string', default: 'http://localhost:3000' },
        out: { type: 'string', default: 'public/metadata-img.png' },
    },
})

const url = new URL('/dev/social-card', values.base)

const browser = await chromium.launch()
try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
    const response = await page.goto(url.href, { waitUntil: 'networkidle' })
    if (!response?.ok()) throw new Error(`${url.href} answered ${response?.status()}`)
    await page.waitForSelector('[data-social-card]')
    await page.waitForFunction(() => [...document.images].every((image) => image.complete))
    await page.evaluate(() => document.fonts.ready)
    // The card is the page; app chrome (toasts, the dev-mode badge) is not part of it.
    await page.evaluate(() => {
        const card = document.querySelector('[data-social-card]')
        for (const element of document.body.querySelectorAll('*')) {
            if (!element.contains(card) && !card.contains(element))
                element.style.setProperty('display', 'none', 'important')
        }
    })
    await page.screenshot({ path: values.out, type: 'png' })
    console.log(`wrote ${values.out} from ${url.href}`)
} finally {
    await browser.close()
}

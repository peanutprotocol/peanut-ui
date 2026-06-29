/**
 * Share-asset capture regression — the card face must NOT be blank.
 *
 * The launch-day bug: <PixelatedCardFace /> paints its pixelated hand into a
 * <canvas> appended ASYNCHRONOUSLY (new Image() → onload → appendChild). If a
 * capture fired before that canvas mounted, html-to-image snapshotted a blank
 * pink card — and the capture SUCCEEDED, so nothing reached Sentry.
 *
 * The deterministic fix gates the Save/Share buttons on PixelatedCardFace's
 * `onReady` (the hand canvas mounting), so a capture can never fire early.
 *
 * This spec proves the guard end-to-end against the real html-to-image path:
 *   1. /dev/share-builder renders <ShareAssetD3 /> and wires "Save image" to
 *      captureShareAsset + downloadBlob (the same capture code the in-app
 *      Share/Save buttons use).
 *   2. Save stays disabled until the card face signals ready — we wait for it
 *      to enable (proves the gate releases only after the canvas mounts).
 *   3. We click Save, intercept the downloaded PNG, decode it IN-BROWSER (an
 *      <img> + <canvas>.getImageData — no extra Node dep), and sample a region
 *      in the CENTRE of the card — the hand's territory, away from the top-left
 *      logo and bottom-left card number. If that region is ENTIRELY the card
 *      pink (#FF90E8) the hand never rendered → the blank-card bug. We assert
 *      it contains non-background pixels (the hand was captured).
 *
 * No harness auth needed — /dev/share-builder is a pure client-render dev page.
 */

import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'

// Asset + card geometry — mirror of shareAssetLayout.ts (CANVAS_W/H, CARD_*).
// Hardcoded (not imported) to match the e2e convention of not pulling app code
// through the '@/' alias into the Playwright tsconfig.
const CANVAS_W = 1200
const CANVAS_H = 900

// Card-pink (PixelatedCardFace background) and asset-blue (ShareAssetD3 bg) as
// [r,g,b]. "Background" = either of these; the hand is neither.
const CARD_PINK: [number, number, number] = [0xff, 0x90, 0xe8]
const ASSET_BLUE: [number, number, number] = [0x90, 0xa8, 0xed]
const COLOR_TOL = 12

// Central card region in 1200×900 canvas coords. The card is centred
// (CARD_LEFT 220, CARD_TOP 210, CARD_W 760, CARD_H ≈ 479 → centre ≈ 600,449).
// This window sits well inside the card and is HAND-ONLY: it excludes the
// peanut logo (top-left ~248–300 px) and the "????" number (bottom-left,
// canvas-y ≳ 615). So a blank card → this window is pure pink; the hand
// present → many non-background pixels. Small enough that the card's -8°
// final rotation can't rotate any background (blue) into it.
const REGION = { x0: 430, y0: 330, x1: 770, y1: 570 }
const SAMPLE_STEP = 6 // sample every 6th canvas-px → a dense grid

test.describe('Share-asset capture (card face is not blank)', () => {
    test('captured PNG card region contains the hand, not just background', async ({ page }, testInfo) => {
        await page.goto('/dev/share-builder', { waitUntil: 'domcontentloaded' })

        const saveBtn = page.getByTestId('save-image')

        // The readiness gate: Save is disabled until the card face's async hand
        // <canvas> mounts (onReady). If it never enables, the gate is broken OR
        // the card never painted — both are failures this spec must catch.
        await expect(saveBtn, 'Save must enable once the card face signals ready').toBeEnabled({ timeout: 60_000 })

        // Let the card-slide / sticker-drop animations settle to their final
        // frame so the card sits at its designed (centred, -8°) position before
        // we capture. The capture itself overrides only the root scale; the
        // card's own transform is whatever frame it's on.
        await page.waitForTimeout(2_500)

        // Click Save → captureShareAsset(node) → downloadBlob() fires a real
        // download of the native-resolution PNG.
        const downloadPromise = page.waitForEvent('download', { timeout: 30_000 })
        await saveBtn.click()
        const download = await downloadPromise
        const pngPath = testInfo.outputPath('share-asset-capture.png')
        await download.saveAs(pngPath)

        // Decode + sample IN-BROWSER: load the PNG into an <img>, paint it to a
        // <canvas>, read it back with getImageData, and count non-background
        // pixels in the central card window. Done in the page (not Node) so we
        // need no PNG-decoder dependency.
        const base64 = readFileSync(pngPath).toString('base64')
        const result = await page.evaluate(
            async ({ b64, canvasW, canvasH, region, pink, blue, tol, step }) => {
                const img = new Image()
                img.src = `data:image/png;base64,${b64}`
                await img.decode()

                const cv = document.createElement('canvas')
                cv.width = img.naturalWidth
                cv.height = img.naturalHeight
                const ctx = cv.getContext('2d')
                if (!ctx) throw new Error('no 2d context')
                ctx.drawImage(img, 0, 0)

                const width = cv.width
                const height = cv.height
                const buf = ctx.getImageData(0, 0, width, height).data

                // Output is captured at pixelRatio 2 (≈2400×1800) — scale canvas
                // coords into output pixels.
                const sx = width / canvasW
                const sy = height / canvasH
                const near = (r: number, g: number, b: number, c: number[]): boolean =>
                    Math.abs(r - c[0]) <= tol && Math.abs(g - c[1]) <= tol && Math.abs(b - c[2]) <= tol

                let sampled = 0
                let nonBackground = 0
                for (let cy = region.y0; cy <= region.y1; cy += step) {
                    for (let cx = region.x0; cx <= region.x1; cx += step) {
                        const px = Math.min(width - 1, Math.round(cx * sx))
                        const py = Math.min(height - 1, Math.round(cy * sy))
                        const idx = (py * width + px) * 4
                        const r = buf[idx]
                        const g = buf[idx + 1]
                        const b = buf[idx + 2]
                        sampled++
                        if (!(near(r, g, b, pink) || near(r, g, b, blue))) nonBackground++
                    }
                }
                return { width, height, sampled, nonBackground }
            },
            {
                b64: base64,
                canvasW: CANVAS_W,
                canvasH: CANVAS_H,
                region: REGION,
                pink: CARD_PINK as number[],
                blue: ASSET_BLUE as number[],
                tol: COLOR_TOL,
                step: SAMPLE_STEP,
            }
        )

        const fraction = result.nonBackground / result.sampled
        // Blank card → fraction ≈ 0 (pure pink). Hand present → a large chunk of
        // the centre is non-pink. A 2% floor cleanly separates the two while
        // staying far below the hand's real coverage (avoids flake).
        expect(
            fraction,
            `card centre is ${(fraction * 100).toFixed(1)}% non-background ` +
                `(${result.nonBackground}/${result.sampled} px; output ${result.width}×${result.height}). ` +
                `≈0% means the pixelated hand never rendered — the blank-card capture bug.`
        ).toBeGreaterThan(0.02)
    })
})

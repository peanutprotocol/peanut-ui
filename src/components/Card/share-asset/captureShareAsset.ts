'use client'

/**
 * captureShareAsset — turns the rendered <ShareAssetD3 /> DOM node into a
 * PNG Blob suitable for the Web Share API (mobile) or a download anchor
 * (desktop / fallback).
 *
 * The asset is authored at native CANVAS_W × CANVAS_H (1200×900). We
 * always capture at that native resolution regardless of the current
 * visual scale — the parent applies `transform: scale(X)` for display,
 * but we want full-fidelity output.
 *
 * Override `transform: none` + explicit `width`/`height` defeats the
 * parent's visual scaling for the duration of the capture, so
 * html-to-image renders the source at native pixel size instead of the
 * (much smaller) visible bounding rect.
 */

import { toBlob } from 'html-to-image'
import { CANVAS_W, CANVAS_H } from './shareAssetLayout'

/**
 * Real Error class so Sentry has a serialisable shape when an inlined
 * image fails. Without this, html-to-image rejects with the raw DOM
 * ErrorEvent from `<img>.onerror`, which has no `.message` and
 * stringifies to `[object Event]` — see issues PEANUT-UI-QHB / QHC.
 *
 * `failedImages` is populated by the `onImageErrorHandler` callback;
 * `originalReject` keeps whatever html-to-image actually rejected with
 * so we don't lose its breadcrumb.
 */
export class ShareAssetCaptureError extends Error {
    readonly failedImages: string[]
    readonly originalReject: unknown
    constructor(message: string, opts: { failedImages: string[]; originalReject: unknown }) {
        super(message)
        this.name = 'ShareAssetCaptureError'
        this.failedImages = opts.failedImages
        this.originalReject = opts.originalReject
    }
}

/**
 * Wait for the asset's content to be painted before we snapshot.
 *
 * The pink card + its drop-shadow are synchronous, but the card's pixelated
 * hand is drawn into a <canvas> that PixelatedCardFace appends ASYNCHRONOUSLY
 * (new Image() → onload → appendChild — see rasterImg / PixelatedHand). Unlike
 * an <img>, html-to-image cannot wait for a not-yet-mounted <canvas>, so
 * capturing too early yields a blank card — just the pink box + its floating
 * shadow (the launch-day "blank share asset" bug; silent — capture succeeds,
 * so nothing reaches Sentry). Gate on:
 *   - document.fonts.ready (the hero/username use a web font)
 *   - every <img> decoded (badge stickers + the card's small logo)
 *   - the async hand <canvas> being mounted
 * bounded by a timeout so a genuinely-stuck asset still captures (never hangs).
 */
const CAPTURE_READY_TIMEOUT_MS = 2500

async function waitForAssetReady(node: HTMLElement): Promise<void> {
    if (typeof document !== 'undefined' && document.fonts?.ready) {
        try {
            await document.fonts.ready
        } catch {
            // fonts.ready can reject in odd states — capture anyway.
        }
    }
    await Promise.all(
        Array.from(node.querySelectorAll('img')).map((img) =>
            typeof img.decode === 'function' ? img.decode().catch(() => undefined) : Promise.resolve()
        )
    )
    // Poll for the async hand canvas to mount (it's appended on image.onload,
    // outside React's tree, so html-to-image can't wait for it on its own).
    const start = typeof performance !== 'undefined' ? performance.now() : 0
    const elapsed = (): number => (typeof performance !== 'undefined' ? performance.now() : Infinity) - start
    while (!node.querySelector('canvas') && elapsed() < CAPTURE_READY_TIMEOUT_MS) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    }
}

export async function captureShareAsset(node: HTMLElement): Promise<Blob> {
    try {
        await waitForAssetReady(node)
        const blob = await toBlob(node, {
            width: CANVAS_W,
            height: CANVAS_H,
            canvasWidth: CANVAS_W,
            canvasHeight: CANVAS_H,
            pixelRatio: 2, // 2× retina for crisp output on Twitter previews
            cacheBust: true,
            style: {
                // Defeat the parent's visual scaling so we render at native size.
                transform: 'none',
                transformOrigin: 'top left',
                width: `${CANVAS_W}px`,
                height: `${CANVAS_H}px`,
            },
        })
        if (!blob) throw new Error('captureShareAsset: html-to-image returned null')
        return blob
    } catch (err) {
        // Real Error → pass through; the message is already useful.
        if (err instanceof Error) throw err
        // html-to-image rejected with a raw DOM ErrorEvent (per
        // node_modules/html-to-image/lib/util.js:209 — `img.onerror = reject`).
        // Pull the failing src off `.target` so Sentry sees the actual URL
        // instead of `[object Event]`.
        const failedImages: string[] = []
        if (err && typeof err === 'object' && 'target' in err) {
            const target = (err as Event).target as HTMLImageElement | null
            if (target?.src) failedImages.push(target.src)
        }
        throw new ShareAssetCaptureError(
            failedImages.length > 0
                ? `html-to-image failed to inline image: ${failedImages.join(', ')}`
                : 'html-to-image rejected without an identifiable failed image',
            { failedImages, originalReject: err }
        )
    }
}

export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

/**
 * Detects whether the current browser can natively share an image PNG
 * via the Web Share API. iOS Safari + Chrome Android handle this;
 * desktop browsers do NOT support `files` in navigator.share.
 *
 * Uses a 1-byte placeholder File so the check is cheap and can run
 * BEFORE expensive capture — desktop callers should skip capture and
 * fall straight back to the text-only intent.
 */
export function canShareImageFiles(): boolean {
    if (typeof navigator === 'undefined') return false
    if (!('share' in navigator) || !('canShare' in navigator)) return false
    const probe = new File([new Uint8Array(1)], 'probe.png', { type: 'image/png' })
    return navigator.canShare({ files: [probe] })
}

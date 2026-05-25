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

export async function captureShareAsset(node: HTMLElement): Promise<Blob> {
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
 * Detects whether the current browser can natively share the captured
 * PNG via the Web Share API. iOS Safari + Chrome Android handle this;
 * desktop browsers do NOT support `files` in navigator.share.
 */
export function canShareImageFile(blob: Blob): boolean {
    if (typeof navigator === 'undefined') return false
    if (!('share' in navigator) || !('canShare' in navigator)) return false
    const file = new File([blob], 'peanut-card.png', { type: 'image/png' })
    return navigator.canShare({ files: [file] })
}

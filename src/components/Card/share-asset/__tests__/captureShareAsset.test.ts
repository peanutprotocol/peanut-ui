/**
 * @jest-environment jsdom
 */
import { ShareAssetCaptureError, waitForAssetReady } from '../captureShareAsset'

describe('ShareAssetCaptureError', () => {
    test('carries failedImages + originalReject + name=ShareAssetCaptureError', () => {
        const original = new Event('error')
        const err = new ShareAssetCaptureError('boom', {
            failedImages: ['https://cdn.example/badge1.png', 'https://cdn.example/badge2.svg'],
            originalReject: original,
        })

        expect(err).toBeInstanceOf(Error)
        expect(err.name).toBe('ShareAssetCaptureError')
        expect(err.message).toBe('boom')
        expect(err.failedImages).toEqual(['https://cdn.example/badge1.png', 'https://cdn.example/badge2.svg'])
        expect(err.originalReject).toBe(original)
    })

    test('is identifiable via instanceof — the caller branch in ShareAssetActions depends on this', () => {
        const err: unknown = new ShareAssetCaptureError('boom', { failedImages: [], originalReject: null })
        expect(err instanceof ShareAssetCaptureError).toBe(true)
        expect(err instanceof Error).toBe(true)
    })
})

/**
 * Regression guard for the launch-day "blank share asset" bug. The card-face
 * hand used to be a runtime <canvas>, which html-to-image silently dropped when
 * toDataURL() returned empty (iOS Safari, SVG-sourced canvas) → blank card, no
 * error. The hand is now a plain <img>, so every visible element of the asset
 * is decode-gated the same way the badge stickers (which never blanked) are.
 * waitForAssetReady must block the snapshot until fonts + every <img> are ready.
 */
describe('waitForAssetReady — share-asset capture readiness gate', () => {
    afterEach(() => {
        // The fonts test stubs document.fonts; drop it so later runs see jsdom's
        // default (undefined) and don't inherit a slow ready promise.
        if (Object.getOwnPropertyDescriptor(document, 'fonts')) {
            // @ts-expect-error — test-only cleanup of the stubbed accessor
            delete document.fonts
        }
    })

    test('does NOT resolve until every <img> has decoded — the hand included', async () => {
        const node = document.createElement('div')
        let resolveHandDecode!: () => void
        const hand = document.createElement('img')
        ;(hand as unknown as { decode: () => Promise<void> }).decode = () =>
            new Promise<void>((resolve) => {
                resolveHandDecode = resolve
            })
        node.appendChild(hand)

        let resolved = false
        const pending = waitForAssetReady(node).then(() => {
            resolved = true
        })
        await new Promise((r) => setTimeout(r, 20))
        expect(resolved).toBe(false) // still gated — a snapshot here could be blank

        resolveHandDecode() // the hand bitmap is ready
        await pending
        expect(resolved).toBe(true)
    })

    test('awaits image decode for every <img> before snapshotting', async () => {
        const node = document.createElement('div')
        const badge = document.createElement('img')
        const hand = document.createElement('img')
        const badgeDecode = jest.fn().mockResolvedValue(undefined)
        const handDecode = jest.fn().mockResolvedValue(undefined)
        ;(badge as unknown as { decode: unknown }).decode = badgeDecode
        ;(hand as unknown as { decode: unknown }).decode = handDecode
        node.appendChild(badge)
        node.appendChild(hand)

        await waitForAssetReady(node)
        expect(badgeDecode).toHaveBeenCalledTimes(1)
        expect(handDecode).toHaveBeenCalledTimes(1)
    })

    test('resolves (never hangs) when images expose no decode() — jsdom / older browsers', async () => {
        const node = document.createElement('div')
        node.appendChild(document.createElement('img')) // no decode() in jsdom
        await expect(waitForAssetReady(node)).resolves.toBeUndefined()
    })

    test('awaits document.fonts.ready before snapshotting', async () => {
        let fontsReady = false
        Object.defineProperty(document, 'fonts', {
            configurable: true,
            value: {
                ready: new Promise<void>((resolve) =>
                    setTimeout(() => {
                        fontsReady = true
                        resolve()
                    }, 20)
                ),
            },
        })
        const node = document.createElement('div')
        await waitForAssetReady(node)
        expect(fontsReady).toBe(true)
    })
})

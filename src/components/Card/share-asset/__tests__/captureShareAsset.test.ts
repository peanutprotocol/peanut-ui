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
 * Regression guard for the launch-day "blank share asset" bug: the card-face
 * hand is an async-mounted <canvas>, and capturing before it mounts produced a
 * blank card. waitForAssetReady must block the snapshot until that canvas is
 * present (+ fonts ready + images decoded), bounded so it never hangs.
 */
describe('waitForAssetReady — share-asset capture readiness gate', () => {
    const realRAF = global.requestAnimationFrame
    beforeEach(() => {
        // jsdom's RAF is ~16ms; make the poll prompt + deterministic.
        global.requestAnimationFrame = ((cb: FrameRequestCallback) =>
            setTimeout(() => cb(performance.now()), 0)) as unknown as typeof requestAnimationFrame
    })
    afterEach(() => {
        global.requestAnimationFrame = realRAF
    })

    test('does NOT resolve until the card-face <canvas> has mounted (the blank-asset bug)', async () => {
        const node = document.createElement('div') // pink box only — no canvas yet
        let resolved = false
        const pending = waitForAssetReady(node).then(() => {
            resolved = true
        })
        await new Promise((r) => setTimeout(r, 40))
        expect(resolved).toBe(false) // still gated — a snapshot here would be blank
        node.appendChild(document.createElement('canvas')) // the hand mounts
        await new Promise((r) => setTimeout(r, 40))
        await pending
        expect(resolved).toBe(true)
    })

    test('resolves (never hangs) if the canvas never mounts — bounded by the timeout', async () => {
        const node = document.createElement('div')
        await expect(waitForAssetReady(node, 40)).resolves.toBeUndefined()
    })

    test('awaits image decode for every <img> before snapshotting', async () => {
        const node = document.createElement('div')
        const img = document.createElement('img')
        const decode = jest.fn().mockResolvedValue(undefined)
        ;(img as unknown as { decode: unknown }).decode = decode
        node.appendChild(img)
        node.appendChild(document.createElement('canvas'))
        await waitForAssetReady(node, 200)
        expect(decode).toHaveBeenCalledTimes(1)
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
        node.appendChild(document.createElement('canvas'))
        await waitForAssetReady(node, 200)
        expect(fontsReady).toBe(true)
    })
})

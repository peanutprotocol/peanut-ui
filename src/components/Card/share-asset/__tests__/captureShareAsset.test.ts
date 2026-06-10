/**
 * @jest-environment jsdom
 */
import { ShareAssetCaptureError } from '../captureShareAsset'

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

/** @jest-environment jsdom */
/**
 * The camera path's onScan failure is reported to Sentry under its own tag,
 * with the full scanned payload (accepted trade-off, PR #2757).
 */
import { renderHook, act } from '@testing-library/react'
import { captureException } from '@sentry/nextjs'
import { useQRScanner } from '../useQRScanner'

let onDecode: (result: { data: string }) => void

jest.mock('qr-scanner', () => ({
    __esModule: true,
    default: class {
        constructor(_video: HTMLVideoElement, cb: (result: { data: string }) => void) {
            onDecode = cb
        }
        start = jest.fn().mockResolvedValue(undefined)
        stop = jest.fn()
        destroy = jest.fn()
        setCamera = jest.fn()
        setInversionMode = jest.fn()
    },
}))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ error: jest.fn(), info: jest.fn() }),
}))
jest.mock('@/hooks/useGetDeviceType', () => ({
    useDeviceType: () => ({ deviceType: 'web' }),
    DeviceType: { IOS: 'ios' },
}))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

// jsdom implements neither, and the hook's cleanup calls both on unmount
HTMLMediaElement.prototype.pause = jest.fn()
HTMLMediaElement.prototype.load = jest.fn()

const PIX_PAYLOAD = '00020101021226' + '0014br.gov.bcb.pix' + 'y'.repeat(68)

it('camera scan: onScan failure is captured with the qr_scan_processing tag', async () => {
    const error = new Error('routing exploded')
    const onScan = jest.fn().mockRejectedValue(error)

    const { result } = renderHook(() => useQRScanner(onScan, undefined, true))

    // the hook only builds the scanner once the video element exists
    const videoRef = result.current.videoRef as React.MutableRefObject<HTMLVideoElement | null>
    videoRef.current = document.createElement('video')
    await act(async () => {
        await result.current.retryCamera()
    })

    await act(async () => {
        onDecode({ data: PIX_PAYLOAD })
    })

    expect(onScan).toHaveBeenCalledWith(PIX_PAYLOAD)
    expect(captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
            tags: { error_type: 'qr_scan_processing' },
            extra: { qrLength: 100, qrKind: 'pix', qrPayload: PIX_PAYLOAD },
        })
    )
})

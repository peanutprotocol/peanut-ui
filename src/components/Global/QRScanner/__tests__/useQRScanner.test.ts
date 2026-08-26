/** @jest-environment jsdom */
/**
 * The camera path's onScan failure is reported to Sentry under its own tag,
 * with the full scanned payload (accepted trade-off, PR #2757).
 */
import { renderHook, act } from '@testing-library/react'
import { captureException } from '@sentry/nextjs'
import { useQRScanner } from '../useQRScanner'

let onDecode: (result: { data: string }) => void
let startBehaviour: () => Promise<void> = () => Promise.resolve()
let startCalls = 0

jest.mock('qr-scanner', () => ({
    __esModule: true,
    default: class {
        constructor(_video: HTMLVideoElement, cb: (result: { data: string }) => void) {
            onDecode = cb
        }
        start = jest.fn(() => {
            startCalls++
            return startBehaviour()
        })
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

describe('resume after backgrounding (TASK-21862)', () => {
    function setHidden(hidden: boolean): void {
        Object.defineProperty(document, 'hidden', { value: hidden, configurable: true })
        document.dispatchEvent(new Event('visibilitychange'))
    }

    async function mountScanning() {
        const { result } = renderHook(() => useQRScanner(jest.fn(), undefined, true))
        const videoRef = result.current.videoRef as React.MutableRefObject<HTMLVideoElement | null>
        videoRef.current = document.createElement('video')
        await act(async () => {
            await result.current.retryCamera()
        })
        // the mount-time start ran before the <video> existed and left a
        // 100ms element-retry timer behind; let it fire before asserting
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 150))
        })
        return result
    }

    afterEach(() => {
        Object.defineProperty(document, 'hidden', { value: false, configurable: true })
        startBehaviour = () => Promise.resolve()
    })

    it('a successful restart returns to the live camera', async () => {
        const result = await mountScanning()
        expect(result.current.isCameraReady).toBe(true)

        await act(async () => setHidden(true))
        expect(result.current.isCameraReady).toBe(false)

        await act(async () => setHidden(false))
        expect(result.current.isCameraReady).toBe(true)
        expect(result.current.error).toBeNull()
    })

    it('a rejected restart shows the error view instead of an endless spinner', async () => {
        const result = await mountScanning()

        await act(async () => setHidden(true))
        startBehaviour = () => Promise.reject(new DOMException('Camera not found.', 'NotFoundError'))
        await act(async () => setHidden(false))

        expect(result.current.isCameraReady).toBe(false)
        expect(result.current.error).toBe('qrScanner.cameraNotFound')
    })

    it('a retry after a failed restart recovers the camera', async () => {
        const result = await mountScanning()

        await act(async () => setHidden(true))
        startBehaviour = () => Promise.reject(new DOMException('Camera not found.', 'NotFoundError'))
        await act(async () => setHidden(false))
        expect(result.current.error).toBe('qrScanner.cameraNotFound')

        startBehaviour = () => Promise.resolve()
        await act(async () => {
            await result.current.retryCamera()
        })
        expect(result.current.error).toBeNull()
        expect(result.current.isCameraReady).toBe(true)
    })

    it('overlapping resumes do not start the camera twice', async () => {
        const result = await mountScanning()
        const before = startCalls

        await act(async () => setHidden(true))
        await act(async () => {
            setHidden(false)
            setHidden(false)
            setHidden(false)
        })

        expect(startCalls - before).toBe(1)
        expect(result.current.isCameraReady).toBe(true)
    })
})

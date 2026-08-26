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
let attachStream = true
let lastOptions: { preferredCamera?: unknown } = {}

jest.mock('qr-scanner', () => ({
    __esModule: true,
    default: class {
        video: HTMLVideoElement
        active = false
        constructor(video: HTMLVideoElement, cb: (result: { data: string }) => void, options: object) {
            onDecode = cb
            this.video = video
            lastOptions = options
        }
        /*
         * Models the library contract the hook now depends on: start() is a
         * no-op while already active, attaches the MediaStream to the <video>
         * before resolving, and clears `active` when acquisition rejects.
         */
        start = jest.fn(async () => {
            if (this.active) return
            this.active = true
            startCalls++
            try {
                await startBehaviour()
            } catch (err) {
                this.active = false
                throw err
            }
            if (attachStream) this.video.srcObject = {} as MediaStream
        })
        stop = jest.fn(() => {
            this.active = false
            this.video.srcObject = null
        })
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

    /*
     * The mount effect starts the camera before the <video> exists and leaves a
     * 100ms element-retry timer behind. Draining that on a real clock raced CI,
     * so run the retry synchronously and assert on a settled scanner.
     */
    async function mountScanning() {
        const { result } = renderHook(() => useQRScanner(jest.fn(), undefined, true))
        const videoRef = result.current.videoRef as React.MutableRefObject<HTMLVideoElement | null>
        videoRef.current = document.createElement('video')
        await act(async () => {
            jest.advanceTimersByTime(100) // CONFIG.VIDEO_ELEMENT_RETRY_DELAY_MS
        })
        return result
    }

    beforeEach(() => {
        jest.useFakeTimers()
        startCalls = 0
        attachStream = true
    })

    afterEach(() => {
        jest.useRealTimers()
        Object.defineProperty(document, 'hidden', { value: false, configurable: true })
        startBehaviour = () => Promise.resolve()
        attachStream = true
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

    it('does not re-enter the camera flow while the error view is up', async () => {
        const result = await mountScanning()

        startBehaviour = () => Promise.reject(new DOMException('nope', 'NotFoundError'))
        await act(async () => {
            await result.current.retryCamera()
        })
        expect(result.current.error).toBe('qrScanner.cameraNotFound')

        // a foreground here used to clear the error, show a spinner and hang on
        // a denied getUserMedia before landing back on the same view
        const before = startCalls
        await act(async () => setHidden(true))
        await act(async () => setHidden(false))
        expect(startCalls).toBe(before)
        expect(result.current.error).toBe('qrScanner.cameraNotFound')
    })

    it('treats a start that resolves without a stream as a failed start', async () => {
        const result = await mountScanning()

        attachStream = false
        await act(async () => {
            await result.current.retryCamera()
        })

        expect(result.current.isCameraReady).toBe(false)
        expect(result.current.error).toBe('qrScanner.cameraStartFailed')
    })

    it('retryCamera ignores the click event its callers pass straight through', async () => {
        const result = await mountScanning()
        expect(lastOptions.preferredCamera).toBe('environment')

        await act(async () => {
            await (result.current.retryCamera as (event: unknown) => Promise<void>)(new MouseEvent('click'))
        })

        // a MouseEvent here becomes qr-scanner's deviceId {exact: ...}
        expect(lastOptions.preferredCamera).toBe('environment')
    })
})

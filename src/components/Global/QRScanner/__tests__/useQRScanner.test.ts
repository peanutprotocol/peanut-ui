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

/*
 * The real classifyCameraFailure runs against this. qr-scanner rejects start()
 * with the bare string 'Camera not found.' whatever went wrong, so the reason a
 * camera failed is only recoverable by asking the browser again — which means
 * these tests have to model the browser, not a rejection shape the library
 * cannot produce.
 */
const browserCamera = {
    // no camera attached by default, which is what the failure tests below assert
    devices: [] as Array<{ kind: string }>,
    probe: (): Promise<MediaStream> => Promise.reject(new DOMException('Device in use', 'NotReadableError')),
}
Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
        enumerateDevices: async () => browserCamera.devices,
        getUserMedia: () => browserCamera.probe(),
    },
})

// what qr-scanner really rejects with — see src/utils/camera-failure.ts
const QR_SCANNER_REJECTION = 'Camera not found.'

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
        startBehaviour = () => Promise.reject(QR_SCANNER_REJECTION)
        await act(async () => setHidden(false))

        expect(result.current.isCameraReady).toBe(false)
        expect(result.current.error).toBe('qrScanner.cameraNotFound')
    })

    it('a retry after a failed restart recovers the camera', async () => {
        const result = await mountScanning()

        await act(async () => setHidden(true))
        startBehaviour = () => Promise.reject(QR_SCANNER_REJECTION)
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

        startBehaviour = () => Promise.reject(QR_SCANNER_REJECTION)
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

/*
 * Every case here was unreachable before classifyCameraFailure: qr-scanner
 * rejects start() with a bare string, so `err instanceof Error` was always
 * false, the name was always empty, and getErrorMessage always fell through to
 * cameraUnavailable with the permission modal on top — for a missing camera as
 * readily as for a denial. The NotReadableError retry loop never ran at all.
 */
describe('classifying a failure the library discarded', () => {
    const CAMERA_RETRY_DELAY_MS = 1000
    const VIDEO_ELEMENT_RETRY_DELAY_MS = 100

    const CAMERA_PRESENT = [{ kind: 'videoinput' }]

    async function mountScanning() {
        const { result } = renderHook(() => useQRScanner(jest.fn(), undefined, true))
        const videoRef = result.current.videoRef as React.MutableRefObject<HTMLVideoElement | null>
        videoRef.current = document.createElement('video')
        await act(async () => {
            jest.advanceTimersByTime(VIDEO_ELEMENT_RETRY_DELAY_MS)
        })
        return result
    }

    async function failTheCamera(result: Awaited<ReturnType<typeof mountScanning>>) {
        startBehaviour = () => Promise.reject(QR_SCANNER_REJECTION)
        await act(async () => {
            await result.current.retryCamera()
        })
    }

    beforeEach(() => {
        jest.useFakeTimers()
        startCalls = 0
        attachStream = true
    })

    afterEach(() => {
        jest.useRealTimers()
        startBehaviour = () => Promise.resolve()
        browserCamera.devices = []
        browserCamera.probe = () => Promise.reject(new DOMException('Device in use', 'NotReadableError'))
        attachStream = true
    })

    it('a denial reaches the permission modal with its own copy', async () => {
        browserCamera.devices = CAMERA_PRESENT
        browserCamera.probe = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'))

        const result = await mountScanning()
        await failTheCamera(result)

        expect(result.current.isPermissionDenied).toBe(true)
        expect(result.current.error).toBe('qrScanner.cameraPermissionDenied')
    })

    it('a missing camera is no longer reported as a denied permission', async () => {
        browserCamera.devices = []

        const result = await mountScanning()
        await failTheCamera(result)

        // the permission modal offers "enable camera access" help that cannot
        // fix a device with no camera in it
        expect(result.current.isPermissionDenied).toBe(false)
        expect(result.current.error).toBe('qrScanner.cameraNotFound')
    })

    it('a busy camera retries, and recovers when the device frees up', async () => {
        browserCamera.devices = CAMERA_PRESENT
        browserCamera.probe = () => Promise.reject(new DOMException('Device in use', 'NotReadableError'))

        const result = await mountScanning()
        await failTheCamera(result)

        expect(result.current.isPermissionDenied).toBe(false)
        expect(result.current.error).toBe('qrScanner.cameraBusyRetrying')

        startBehaviour = () => Promise.resolve()
        await act(async () => {
            jest.advanceTimersByTime(CAMERA_RETRY_DELAY_MS)
        })

        expect(result.current.error).toBeNull()
        expect(result.current.isCameraReady).toBe(true)
    })

    it('a camera that stays busy stops retrying and says so', async () => {
        browserCamera.devices = CAMERA_PRESENT
        browserCamera.probe = () => Promise.reject(new DOMException('Device in use', 'NotReadableError'))

        const result = await mountScanning()
        await failTheCamera(result)

        // MAX_CAMERA_RETRIES attempts, each a retry delay apart
        for (let attempt = 0; attempt < 3; attempt++) {
            await act(async () => {
                jest.advanceTimersByTime(CAMERA_RETRY_DELAY_MS)
            })
        }

        expect(result.current.error).toBe('qrScanner.cameraStillBusy')
        expect(result.current.isPermissionDenied).toBe(false)
    })
})

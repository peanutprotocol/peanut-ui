/** @jest-environment jsdom */
/**
 * The value under test is qr-scanner's real one. Its _getCameraStream swallows
 * every getUserMedia DOMException and then throws the bare string
 * 'Camera not found.', whatever actually went wrong — so a DOMException never
 * reaches the hook from the library, and no assertion here may pretend it does.
 */
import { classifyCameraFailure, CAMERA_ERRORS } from '../camera-failure'

const QR_SCANNER_REJECTION = 'Camera not found.'

type MediaDevicesStub = {
    enumerateDevices: jest.Mock
    getUserMedia: jest.Mock
}

let mediaDevices: MediaDevicesStub

const setMediaDevices = (value: MediaDevicesStub | undefined) => {
    Object.defineProperty(navigator, 'mediaDevices', { value, configurable: true })
}

const track = () => ({ stop: jest.fn() })

beforeEach(() => {
    mediaDevices = {
        enumerateDevices: jest.fn().mockResolvedValue([{ kind: 'videoinput', deviceId: 'cam', label: '' }]),
        getUserMedia: jest.fn(),
    }
    setMediaDevices(mediaDevices)
})

afterEach(() => setMediaDevices(undefined))

it('keeps the name of an error thrown by our own code rather than probing', async () => {
    // a chunk load, the scanner constructor, applyConstraints — these are real
    // Errors and already say what went wrong
    await expect(classifyCameraFailure(new DOMException('nope', 'AbortError'))).resolves.toBe('AbortError')
    expect(mediaDevices.getUserMedia).not.toHaveBeenCalled()
})

it('reports a denial the library swallowed', async () => {
    mediaDevices.getUserMedia.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'))

    await expect(classifyCameraFailure(QR_SCANNER_REJECTION)).resolves.toBe(CAMERA_ERRORS.NOT_ALLOWED)
})

it('reports a busy camera the library swallowed', async () => {
    mediaDevices.getUserMedia.mockRejectedValue(new DOMException('Device in use', 'NotReadableError'))

    await expect(classifyCameraFailure(QR_SCANNER_REJECTION)).resolves.toBe(CAMERA_ERRORS.NOT_READABLE)
})

it('reports absent hardware without opening a camera', async () => {
    mediaDevices.enumerateDevices.mockResolvedValue([{ kind: 'audioinput', deviceId: 'mic', label: '' }])

    await expect(classifyCameraFailure(QR_SCANNER_REJECTION)).resolves.toBe(CAMERA_ERRORS.NOT_FOUND)
    expect(mediaDevices.getUserMedia).not.toHaveBeenCalled()
})

it('treats a probe that succeeds as transient contention, and releases it', async () => {
    const videoTrack = track()
    mediaDevices.getUserMedia.mockResolvedValue({ getTracks: () => [videoTrack] })

    // the library could not open what the probe just opened, so the device is
    // present and permitted — retryable, not denied
    await expect(classifyCameraFailure(QR_SCANNER_REJECTION)).resolves.toBe(CAMERA_ERRORS.NOT_READABLE)
    expect(videoTrack.stop).toHaveBeenCalled()
})

it('gives up on a probe that hangs, as an iOS PWA getUserMedia does after denial', async () => {
    jest.useFakeTimers()
    mediaDevices.getUserMedia.mockReturnValue(new Promise(() => {}))

    const classified = classifyCameraFailure(QR_SCANNER_REJECTION)
    // async form: the timeout is only scheduled once the enumerateDevices await
    // resolves, so the microtasks in between have to drain first
    await jest.advanceTimersByTimeAsync(2000) // PROBE_TIMEOUT_MS

    await expect(classified).resolves.toBe('')
    jest.useRealTimers()
})

it('reports absent hardware when the browser exposes no camera api at all', async () => {
    setMediaDevices(undefined)

    await expect(classifyCameraFailure(QR_SCANNER_REJECTION)).resolves.toBe(CAMERA_ERRORS.NOT_FOUND)
})

it('never throws, whatever the browser does', async () => {
    mediaDevices.enumerateDevices.mockRejectedValue(new Error('boom'))

    await expect(classifyCameraFailure(QR_SCANNER_REJECTION)).resolves.toBe('')
})

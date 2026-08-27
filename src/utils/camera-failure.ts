/**
 * Recovers why a camera start failed.
 *
 * qr-scanner 1.4.2 walks a ladder of getUserMedia constraint sets and swallows
 * every DOMException on the way (`catch(f){}`), then rejects start() with the
 * bare string 'Camera not found.' — so denial, absent hardware and a busy
 * device all arrive here indistinguishable, and none of them is an Error.
 *
 * The library's ladder ends on a plain `{video:{}}`, which is exactly
 * `{video:true}`. Repeating that last rung therefore reproduces the request
 * that just failed and hands back the DOMException the library discarded.
 */

export const CAMERA_ERRORS = {
    NOT_ALLOWED: 'NotAllowedError',
    NOT_READABLE: 'NotReadableError',
    NOT_FOUND: 'NotFoundError',
} as const

// The probe inherits the hang it is diagnosing: an iOS PWA getUserMedia can
// stall forever after a denial rather than reject. Give up and report nothing
// rather than hold the error screen back on a promise that may never settle.
const PROBE_TIMEOUT_MS = 2000

const UNKNOWN = ''

const nameOf = (err: unknown): string => (err instanceof Error ? err.name : UNKNOWN)

async function hasVideoInput(): Promise<boolean> {
    // labels stay empty without a grant, but the entries themselves are listed,
    // so this separates "no camera" from "camera we are not allowed to open"
    // without opening anything
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.some((device) => device.kind === 'videoinput')
}

async function probeCamera(): Promise<string> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let stream: MediaStream | undefined
    try {
        stream = await Promise.race([
            navigator.mediaDevices.getUserMedia({ video: true, audio: false }),
            new Promise<undefined>((resolve) => {
                timeoutId = setTimeout(resolve, PROBE_TIMEOUT_MS, undefined)
            }),
        ])
    } catch (err) {
        return nameOf(err)
    } finally {
        clearTimeout(timeoutId)
        stream?.getTracks().forEach((track) => track.stop())
    }

    /*
     * The probe opened the camera the library could not, so the device is
     * present and permitted and the failure was transient — contention with
     * another consumer, or hardware still settling. NotReadable is both true and
     * the one classification the caller retries on.
     */
    return stream ? CAMERA_ERRORS.NOT_READABLE : UNKNOWN
}

/**
 * Maps a camera start failure to a DOMException name, or '' when it cannot be
 * determined. Never throws.
 */
export async function classifyCameraFailure(err: unknown): Promise<string> {
    // anything that is already an Error came from our own code — a chunk load, the
    // scanner constructor, applyConstraints — and carries its own name
    const thrownName = nameOf(err)
    if (thrownName) return thrownName

    try {
        if (!navigator.mediaDevices?.getUserMedia) return CAMERA_ERRORS.NOT_FOUND
        if (!(await hasVideoInput())) return CAMERA_ERRORS.NOT_FOUND
        return await probeCamera()
    } catch {
        return UNKNOWN
    }
}

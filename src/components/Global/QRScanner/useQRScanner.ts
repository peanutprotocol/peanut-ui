import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/0_Bruddle/Toast'
import QrScannerLib from 'qr-scanner'
import { useDeviceType, DeviceType } from '@/hooks/useGetDeviceType'
import { isCapacitor } from '@/utils/capacitor'
import { ensureNativeCameraPermission } from '@/utils/camera-permission'
import { reportQrScanError } from './utils'
import { toError } from '@/utils/to-error'

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
    CAMERA_RETRY_DELAY_MS: 1000,
    MAX_CAMERA_RETRIES: 3,
    IOS_CAMERA_DELAY_MS: 200,
    // How long a web/PWA start() may run before the permission modal takes over
    // the screen. Not an expiry: the attempt keeps running behind the modal, so
    // this is only how long the user waits for actionable UI.
    CAMERA_START_TIMEOUT_MS: 5000,
    /*
     * A ceiling, not a fixed rate. qr-scanner drives its loop from
     * requestVideoFrameCallback (rAF as fallback) and then enforces a minimum
     * 1000/maxScansPerSecond gap, so the real rate is min(camera frame
     * delivery, this). A struggling device already scans less on its own.
     *
     * Which is why 1.0.45 dropping this to 4 to "protect low-end WebViews"
     * mostly penalised the devices that were keeping up: it put 250ms between
     * decode attempts, and the attempts that matter are the ones during hand
     * movement, glare or an angled dense code — where a first try rarely
     * lands. 12 gives those cases three attempts where 4 gave one, stays well
     * under the library's own default of 25, and still samples under half the
     * frames of a 30fps camera.
     */
    SCANNER_MAX_SCANS_PER_SECOND: 12,
    // just long enough to cover the drawer close animation — the camera keeps
    // streaming until this fires
    SCANNER_CLOSE_DELAY_MS: 300,
    VIDEO_ELEMENT_RETRY_DELAY_MS: 100,
    MAX_VIDEO_ELEMENT_RETRIES: 2,
} as const

const CAMERA_ERRORS = {
    NOT_ALLOWED: 'NotAllowedError',
    NOT_READABLE: 'NotReadableError',
    NOT_FOUND: 'NotFoundError',
} as const

/**
 * Scan region: half the video area, centered slightly above middle.
 * Uses 800x800 downscale for dense QR codes (Mercado Pago, PIX).
 */
const calculateScanRegion = (video: HTMLVideoElement) => {
    const regionW = Math.round(video.videoWidth * 0.7)
    const regionH = Math.round(video.videoHeight * 0.7)

    return {
        x: Math.round((video.videoWidth - regionW) / 2),
        y: Math.round(((video.videoHeight - regionH) / 2) * 0.7),
        width: regionW,
        height: regionH,
        downScaledWidth: Math.min(regionW, 800),
        downScaledHeight: Math.min(regionH, 800),
    }
}

const SCANNER_OPTIONS = {
    returnDetailedScanResult: true,
    highlightScanRegion: false,
    // Drawn only once a code is actually found, so it costs nothing while the
    // user is still hunting for one. It is also the only signal that the
    // scanner has locked on: without it a slow read is indistinguishable from
    // a broken scanner, which is how 1.0.45 read to users.
    highlightCodeOutline: true,
    maxScansPerSecond: CONFIG.SCANNER_MAX_SCANS_PER_SECOND,
    calculateScanRegion,
} as const

// Module-level deduplication to handle rapid-fire callbacks from qr-scanner
// This is outside React's lifecycle so it's synchronously checked before any re-renders
let lastScan: { data: string; timestamp: number } | null = null
const SCAN_DEBOUNCE_MS = 1000

/**
 * Waits on a start attempt without taking ownership of it: 'started' when the
 * camera came up in time, 'pending' when the deadline won and the attempt is
 * still outstanding. Rejects with whatever start() rejected with.
 */
async function raceStartDeadline(started: Promise<void>): Promise<'started' | 'pending'> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    try {
        return await Promise.race([
            started.then(() => 'started' as const),
            new Promise<'pending'>((resolve) => {
                timeoutId = setTimeout(resolve, CONFIG.CAMERA_START_TIMEOUT_MS, 'pending')
            }),
        ])
    } finally {
        clearTimeout(timeoutId)
    }
}

// ============================================================================
// Types
// ============================================================================

export type QRScanHandler = (data: string) => Promise<{ success: boolean; error?: string }>

type FacingMode = 'user' | 'environment'

// ============================================================================
// Hook
// ============================================================================

export function useQRScanner(onScan: QRScanHandler, onClose: (() => void) | undefined, isOpen: boolean) {
    const [error, setError] = useState<string | null>(null)
    const [isPermissionDenied, setIsPermissionDenied] = useState(false)
    const [facingMode, setFacingMode] = useState<FacingMode>('environment')
    const [isScanning, setIsScanning] = useState(isOpen)
    const [isCameraReady, setIsCameraReady] = useState(false)

    const t = useTranslations('global')
    const toast = useToast()
    const { deviceType } = useDeviceType()

    // Use ref for processingQR to avoid stale closure issues in scanner callback
    const processingQRRef = useRef(false)

    // track isScanning in a ref to avoid stale closures in setTimeout callbacks
    const isScanningRef = useRef(isScanning)

    // Refs declared individually (not in an object) to maintain stable references across renders
    const videoRef = useRef<HTMLVideoElement>(null)
    const scannerRef = useRef<QrScannerLib | null>(null)
    const retryCountRef = useRef<number>(0)
    const videoElementRetryCountRef = useRef<number>(0)
    const isSwitchingCameraRef = useRef(false)
    // bumped by every startCamera; a start whose generation is stale was
    // superseded mid-await and must not commit state or touch the new scanner
    const startGenRef = useRef(0)
    const startCameraRef = useRef<((preferredCamera?: FacingMode) => Promise<void>) | null>(null)

    // -------------------------------------------------------------------------
    // Scanner Lifecycle
    // -------------------------------------------------------------------------

    const cleanup = useCallback(() => {
        if (scannerRef.current) {
            scannerRef.current.stop()
            scannerRef.current.destroy()
            scannerRef.current = null
        }
        if (videoRef.current) {
            // Critical for iOS to stop camera recording
            videoRef.current.pause()
            videoRef.current.srcObject = null
            videoRef.current.load()
        }
    }, [])

    const close = useCallback(() => {
        try {
            cleanup()
            setIsScanning(false)
            onClose?.()
        } catch (err) {
            console.error('Error closing QR scanner:', err)
        }
    }, [cleanup, onClose])

    // -------------------------------------------------------------------------
    // QR Processing
    // -------------------------------------------------------------------------

    const handleQRScan = useCallback(
        async (data: string) => {
            const now = Date.now()

            // debug: log when qr is decoded by library
            console.log('[QR Scanner] QR decoded by library:', data.substring(0, 50) + '...')

            // Module-level deduplication: ignore if same data within debounce window
            if (lastScan && lastScan.data === data && now - lastScan.timestamp < SCAN_DEBOUNCE_MS) {
                return
            }

            // Update module-level tracker immediately (synchronous, before any async work)
            lastScan = { data, timestamp: now }

            // Also use ref as secondary guard for different QR codes scanned rapidly
            if (processingQRRef.current) return
            processingQRRef.current = true

            // Stop scanner immediately to prevent additional callbacks being queued
            scannerRef.current?.stop()

            try {
                const result = await onScan(data)

                if (result.success) {
                    toast.info(t('qrScanner.qrRecognized'))
                } else {
                    toast.error(result.error || t('qrScanner.qrProcessingFailed'))
                    processingQRRef.current = false
                    // Resume scanner on failure so user can try again
                    scannerRef.current?.start().catch(() => startCameraRef.current?.())
                }
            } catch (err) {
                // console.info, not error: captureConsoleIntegration would turn an
                // error-level log into a second Sentry event on top of the capture below.
                console.info('Error processing QR code:', err)
                reportQrScanError(err, data)
                toast.error(t('qrScanner.qrProcessingError'))
                processingQRRef.current = false
                // Resume scanner on error so user can try again
                scannerRef.current?.start().catch(() => startCameraRef.current?.())
            }
        },
        [onScan, toast, t]
    )

    // -------------------------------------------------------------------------
    // Camera Management
    // -------------------------------------------------------------------------

    const getErrorMessage = useCallback(
        (errorName: string, retryCount: number): string | null => {
            switch (errorName) {
                case CAMERA_ERRORS.NOT_ALLOWED:
                    return t('qrScanner.cameraPermissionDenied')
                case CAMERA_ERRORS.NOT_READABLE:
                    if (retryCount < CONFIG.MAX_CAMERA_RETRIES) {
                        return t('qrScanner.cameraBusyRetrying', {
                            attempt: retryCount + 1,
                            maxAttempts: CONFIG.MAX_CAMERA_RETRIES,
                        })
                    }
                    return t('qrScanner.cameraStillBusy')
                case CAMERA_ERRORS.NOT_FOUND:
                    return t('qrScanner.cameraNotFound')
                default:
                    return t('qrScanner.cameraUnavailable')
            }
        },
        [t]
    )

    /*
     * Owns a getUserMedia call that outlived its deadline. The permission modal
     * goes up so the user is never stranded on a spinner (and keeps the retry
     * and paste fallbacks), while the attempt keeps running underneath: a user
     * who was still reading the OS prompt gets the camera the moment they
     * allow it. The scanner is deliberately NOT torn down here — destroying it
     * is what threw the pending grant away.
     *
     * Recovery restarts rather than adopting the resolved stream: the modal
     * unmounts the <video> the pending scanner is bound to, so the element the
     * user would see is a fresh one that needs its own start.
     */
    const adoptPendingStart = useCallback(
        (started: Promise<void>, superseded: () => boolean, preferredCamera: FacingMode) => {
            const stale = () => superseded() || !isScanningRef.current

            started
                .then(() => {
                    if (stale()) return
                    // qr-scanner resolves start() without a stream while the
                    // document is hidden, so a rebuild here would swap the
                    // modal for a false "camera start failed" — the visibility
                    // listener already owns recovery on the way back
                    if (document.hidden) return
                    void startCameraRef.current?.(preferredCamera)
                })
                .catch(() => {
                    /*
                     * No classification is possible here. qr-scanner 1.4.2
                     * swallows every getUserMedia DOMException in _getCameraStream
                     * and rejects start() with the bare string 'Camera not found.',
                     * so denial, missing hardware and a busy camera are one
                     * indistinguishable failure by the time it reaches us. The
                     * modal is already up and is the one state that offers both
                     * retry and paste, so leave the user on it.
                     */
                    if (stale()) return
                    cleanup()
                })

            setIsPermissionDenied(true)
            setError(getErrorMessage(CAMERA_ERRORS.NOT_ALLOWED, 0))
        },
        [cleanup, getErrorMessage]
    )

    const startCamera = useCallback(
        async (preferredCamera: FacingMode = facingMode) => {
            setError(null)
            setIsPermissionDenied(false)
            setIsCameraReady(false)

            if (!videoRef.current) {
                // retry if video element not ready (react mounting race condition)
                if (videoElementRetryCountRef.current < CONFIG.MAX_VIDEO_ELEMENT_RETRIES) {
                    videoElementRetryCountRef.current++
                    setTimeout(() => {
                        if (isScanningRef.current) startCamera(preferredCamera)
                    }, CONFIG.VIDEO_ELEMENT_RETRY_DELAY_MS)
                    return
                }
                setError(t('qrScanner.cameraStartFailed'))
                videoElementRetryCountRef.current = 0
                return
            }

            // reset retry counter on success
            videoElementRetryCountRef.current = 0

            const generation = ++startGenRef.current
            const superseded = () => generation !== startGenRef.current

            try {
                cleanup()

                if (isCapacitor()) {
                    const granted = await ensureNativeCameraPermission()
                    if (superseded()) return
                    if (!granted) {
                        setIsPermissionDenied(true)
                        setError(getErrorMessage(CAMERA_ERRORS.NOT_ALLOWED, 0))
                        return
                    }
                }

                // iOS needs a delay to release camera hardware
                if (deviceType === DeviceType.IOS) {
                    await new Promise((resolve) => setTimeout(resolve, CONFIG.IOS_CAMERA_DELAY_MS))
                }

                // the drawer may have closed, or a newer start may have taken
                // over, while the settle delay ran
                if (superseded()) return
                if (!isScanningRef.current || !videoRef.current) {
                    cleanup()
                    return
                }

                /*
                 * Statically imported. It was lazy-loaded in 1.0.45 to keep the
                 * decoder off the app shell's critical path, but that only defers
                 * qr-scanner's 15KB wrapper — the 43KB worker that does the decoding
                 * is fetched separately at construction either way, and on native the
                 * whole export is on local disk, so the win was a millisecond of parse
                 * time. It cost a gap between the camera going live and scanning
                 * starting, and put a ChunkLoadError inside the camera catch below,
                 * where anything that is not NotFound/NotReadable is reported to the
                 * user as denied camera permission.
                 */
                const scanner = new QrScannerLib(videoRef.current, (result) => handleQRScan(result.data), {
                    ...SCANNER_OPTIONS,
                    preferredCamera,
                })

                scanner.setInversionMode('original')

                scannerRef.current = scanner

                if (isCapacitor()) {
                    // Native (Capacitor) resolves getUserMedia once the OS permission
                    // dialog is answered and rejects cleanly on denial, so no timeout is
                    // needed. Racing the short timeout made the first-run permission
                    // prompt look like a failure (false "Camera start timed out" → retry).
                    await scanner.start()
                } else {
                    /*
                     * iOS PWA (WKWebView) getUserMedia can hang forever after the user
                     * denies permission instead of rejecting, so a deadline is still
                     * what puts the permission modal on screen. But that hang is
                     * indistinguishable from a prompt the user simply has not answered
                     * yet, and rejecting at five seconds tore down a camera that
                     * arrived moments later (TASK-21927). So the deadline no longer
                     * ends the attempt: it hands the still-pending start() to
                     * adoptPendingStart and lets the permission modal cover the wait.
                     */
                    const started = scanner.start()
                    if ((await raceStartDeadline(started)) === 'pending') {
                        adoptPendingStart(started, superseded, preferredCamera)
                        return
                    }
                }

                if (superseded() || !isScanningRef.current) return

                /*
                 * qr-scanner resolves start() without a stream when it was
                 * stopped mid-acquisition (it discards the stream once
                 * _active is false) or when the document was hidden. Reporting
                 * ready here is what leaves a black <video> under a dismissed
                 * spinner, so treat a missing stream as a failed start.
                 */
                if (!videoRef.current?.srcObject) {
                    cleanup()
                    setError(t('qrScanner.cameraStartFailed'))
                    return
                }

                // Request continuous autofocus — some devices default to single-shot
                // focus on start, leaving the image blurry when the user moves the phone.
                try {
                    const stream = videoRef.current?.srcObject as MediaStream | null
                    const track = stream?.getVideoTracks()[0]
                    if (track && 'applyConstraints' in track) {
                        await track.applyConstraints({
                            advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
                        })
                    }
                } catch {
                    // Not all devices support focusMode — safe to ignore
                }

                console.log('[QR Scanner] Camera started, ready to scan')
                setIsCameraReady(true)
                retryCountRef.current = 0
            } catch (err) {
                cleanup()
                console.error('Error accessing camera:', toError(err))

                const errName = err instanceof Error ? err.name : ''
                const shouldRetry =
                    errName === CAMERA_ERRORS.NOT_READABLE && retryCountRef.current < CONFIG.MAX_CAMERA_RETRIES

                // treat any non-retryable, non-hardware error as permission denied.
                // the qr-scanner library may wrap or rename the browser's NotAllowedError.
                // exclude NOT_READABLE (camera busy) — it has its own "remains busy" error path.
                if (!shouldRetry && errName !== CAMERA_ERRORS.NOT_FOUND && errName !== CAMERA_ERRORS.NOT_READABLE) {
                    setIsPermissionDenied(true)
                }

                setError(getErrorMessage(errName, retryCountRef.current))

                if (shouldRetry) {
                    retryCountRef.current++
                    setTimeout(() => {
                        if (isScanningRef.current) startCamera(preferredCamera)
                    }, CONFIG.CAMERA_RETRY_DELAY_MS)
                } else {
                    retryCountRef.current = 0
                }
            }
        },
        [facingMode, deviceType, cleanup, handleQRScan, getErrorMessage, adoptPendingStart, t]
    )

    const toggleCamera = useCallback(async () => {
        if (!scannerRef.current || !isScanning || isSwitchingCameraRef.current) return

        const newFacingMode: FacingMode = facingMode === 'user' ? 'environment' : 'user'

        /*
         * setCamera tears the old stream down before the new one starts, so the
         * <video> paints a dead frame for the whole handover (hundreds of ms on
         * Android WebView). Drop isCameraReady for the gap — the existing
         * "starting camera" placeholder covers the video — and guard against a
         * second toggle racing overlapping stream restarts.
         */
        isSwitchingCameraRef.current = true
        setIsCameraReady(false)
        const scanner = scannerRef.current
        try {
            await scanner.setCamera(newFacingMode)
            // a resume or retry may have rebuilt the scanner during the
            // handover; committing facingMode now would describe a dead stream
            if (scannerRef.current !== scanner) return
            setFacingMode(newFacingMode)
            if (isScanningRef.current) setIsCameraReady(true)
        } catch (err) {
            console.error('Error switching camera:', toError(err))
            setError(t('qrScanner.cameraSwitchFailed'))
        } finally {
            isSwitchingCameraRef.current = false
        }
    }, [facingMode, isScanning, t])

    // -------------------------------------------------------------------------
    // Effects
    // -------------------------------------------------------------------------

    // sync ref with isScanning state to avoid stale closures in setTimeout callbacks
    useEffect(() => {
        isScanningRef.current = isScanning
    }, [isScanning])

    // the visibility listener subscribes once; read startCamera through a ref
    useEffect(() => {
        startCameraRef.current = startCamera
    }, [startCamera])

    // Handle visibility change - pause camera when app goes to background
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                scannerRef.current?.stop()
                // resume repaints from a cold stream — show the placeholder until then
                setIsCameraReady(false)
            } else if (isScanningRef.current && scannerRef.current) {
                /*
                 * iOS reclaims the capture device while backgrounded, so this
                 * start() can reject with "Camera not found" even though the
                 * same session had a working camera (PEANUT-UI-SV1). Falling
                 * back to a full rebuild recovers it, and if that fails too the
                 * user lands on the error view instead of an endless spinner.
                 *
                 * Deliberately still the scanner's own start() on the happy
                 * path: it re-arms the instance the hidden branch stopped, and
                 * skips a decode-worker rebuild on every foreground.
                 */
                scannerRef.current
                    .start()
                    .then(() => {
                        if (!isScanningRef.current) return
                        // start() also resolves without a stream when it was
                        // stopped mid-acquisition — rebuild rather than show a
                        // ready state over a dead <video>
                        if (!videoRef.current?.srcObject) {
                            void startCameraRef.current?.()
                            return
                        }
                        setIsCameraReady(true)
                    })
                    .catch(() => startCameraRef.current?.())
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [])

    // Start/stop scanner based on isScanning state
    useEffect(() => {
        if (isScanning) {
            startCamera()
        } else {
            cleanup()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isScanning]) // Intentionally only depend on isScanning to avoid infinite loops

    // Sync with isOpen prop
    useEffect(() => {
        if (!isOpen) {
            setTimeout(close, CONFIG.SCANNER_CLOSE_DELAY_MS)
        } else {
            setIsScanning(isOpen)
        }
    }, [isOpen, close])

    // Cleanup on unmount
    useEffect(() => {
        return () => cleanup()
    }, [cleanup])

    return {
        error,
        isPermissionDenied,
        isScanning,
        isCameraReady,
        videoRef,
        close,
        toggleCamera,
        // wrapped: callers wire this straight to onClick, and a MouseEvent
        // arriving as preferredCamera makes qr-scanner ask for deviceId {exact: [object MouseEvent]}
        retryCamera: () => startCamera(),
    }
}

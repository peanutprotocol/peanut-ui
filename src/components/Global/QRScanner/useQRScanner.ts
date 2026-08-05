import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/0_Bruddle/Toast'
import QrScannerLib from 'qr-scanner'
import { useDeviceType, DeviceType } from '@/hooks/useGetDeviceType'
import { isCapacitor } from '@/utils/capacitor'

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
    CAMERA_RETRY_DELAY_MS: 1000,
    MAX_CAMERA_RETRIES: 3,
    IOS_CAMERA_DELAY_MS: 200,
    // in iOS PWA (WKWebView), getUserMedia can hang forever after denial
    // instead of rejecting. timeout ensures the permission modal still shows.
    CAMERA_START_TIMEOUT_MS: 5000,
    SCANNER_MAX_SCANS_PER_SECOND: 8,
    SCANNER_CLOSE_DELAY_MS: 1500,
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
    highlightCodeOutline: true,
    maxScansPerSecond: CONFIG.SCANNER_MAX_SCANS_PER_SECOND,
    calculateScanRegion,
} as const

// Module-level deduplication to handle rapid-fire callbacks from qr-scanner
// This is outside React's lifecycle so it's synchronously checked before any re-renders
let lastScan: { data: string; timestamp: number } | null = null
const SCAN_DEBOUNCE_MS = 1000

// ============================================================================
// Types
// ============================================================================

export type QRScanHandler = (data: string) => Promise<{ success: boolean; error?: string }>

type FacingMode = 'user' | 'environment'

/**
 * On native, settle the OS camera permission before getUserMedia runs, so the
 * scanner opens straight to a live camera instead of prompting mid-view. Best
 * effort: on any plugin error we return true and let getUserMedia trigger the
 * WebView's own permission flow (unchanged fallback).
 */
async function ensureNativeCameraPermission(): Promise<boolean> {
    try {
        const { Camera } = await import('@capacitor/camera')
        const status = await Camera.checkPermissions()
        if (status.camera === 'granted' || status.camera === 'limited') return true
        const requested = await Camera.requestPermissions({ permissions: ['camera'] })
        return requested.camera === 'granted' || requested.camera === 'limited'
    } catch (err) {
        console.warn('Native camera permission check failed, falling back to getUserMedia:', err)
        return true
    }
}

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
                    scannerRef.current?.start()
                }
            } catch (err) {
                console.error('Error processing QR code:', err)
                toast.error(t('qrScanner.qrProcessingError'))
                processingQRRef.current = false
                // Resume scanner on error so user can try again
                scannerRef.current?.start()
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

            let startTimeoutId: ReturnType<typeof setTimeout> | undefined
            try {
                cleanup()

                if (isCapacitor()) {
                    const granted = await ensureNativeCameraPermission()
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
                    // iOS PWA (WKWebView) getUserMedia can hang forever after the user
                    // denies permission instead of rejecting — race a timeout so the
                    // permission modal still shows.
                    await Promise.race([
                        scanner.start(),
                        new Promise<never>((_, reject) => {
                            startTimeoutId = setTimeout(
                                () => reject(new DOMException('Camera start timed out', 'NotAllowedError')),
                                CONFIG.CAMERA_START_TIMEOUT_MS
                            )
                        }),
                    ])
                    clearTimeout(startTimeoutId)
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
                clearTimeout(startTimeoutId)
                cleanup()
                console.error('Error accessing camera:', err)

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
        [facingMode, deviceType, cleanup, handleQRScan, getErrorMessage, t]
    )

    const toggleCamera = useCallback(async () => {
        if (!scannerRef.current || !isScanning) return

        const newFacingMode: FacingMode = facingMode === 'user' ? 'environment' : 'user'

        try {
            await scannerRef.current.setCamera(newFacingMode)
            setFacingMode(newFacingMode)
        } catch (err) {
            console.error('Error switching camera:', err)
            setError(t('qrScanner.cameraSwitchFailed'))
        }
    }, [facingMode, isScanning, t])

    // -------------------------------------------------------------------------
    // Effects
    // -------------------------------------------------------------------------

    // sync ref with isScanning state to avoid stale closures in setTimeout callbacks
    useEffect(() => {
        isScanningRef.current = isScanning
    }, [isScanning])

    // Handle visibility change - pause camera when app goes to background
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                scannerRef.current?.stop()
            } else if (isScanning && scannerRef.current) {
                scannerRef.current.start()
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [isScanning])

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
        retryCamera: startCamera,
    }
}

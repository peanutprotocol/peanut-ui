import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/0_Bruddle/Toast'
import QrScannerLib from 'qr-scanner'
import { useDeviceType, DeviceType } from '@/hooks/useGetDeviceType'

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
    CAMERA_RETRY_DELAY_MS: 1000,
    MAX_CAMERA_RETRIES: 3,
    IOS_CAMERA_DELAY_MS: 200,
    SCANNER_MAX_SCANS_PER_SECOND: 25,
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
 * Custom scan region: top 2/3 of video, horizontally centered.
 * Matches the visual overlay position better.
 * Uses 800x800 downscale for dense QR codes (Mercado Pago, PIX).
 */
const calculateScanRegion = (video: HTMLVideoElement) => {
    // Use 2/3 of the smaller dimension for a square scan region
    const smallerDimension = Math.min(video.videoWidth, video.videoHeight)
    const scanRegionSize = Math.round((2 / 3) * smallerDimension)

    return {
        x: Math.round((video.videoWidth - scanRegionSize) / 2), // Centered horizontally
        y: 0, // Top aligned
        width: scanRegionSize,
        height: scanRegionSize,
        // Larger downscale for dense QR codes (default is 400x400)
        downScaledWidth: Math.min(scanRegionSize, 800),
        downScaledHeight: Math.min(scanRegionSize, 800),
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

// ============================================================================
// Hook
// ============================================================================

export function useQRScanner(onScan: QRScanHandler, onClose: (() => void) | undefined, isOpen: boolean) {
    const [error, setError] = useState<string | null>(null)
    const [facingMode, setFacingMode] = useState<FacingMode>('environment')
    const [isScanning, setIsScanning] = useState(isOpen)

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
                    toast.info('QR code recognized')
                } else {
                    toast.error(result.error || 'QR code processing failed')
                    processingQRRef.current = false
                    // Resume scanner on failure so user can try again
                    scannerRef.current?.start()
                }
            } catch (err) {
                console.error('Error processing QR code:', err)
                toast.error('Error processing QR code')
                processingQRRef.current = false
                // Resume scanner on error so user can try again
                scannerRef.current?.start()
            }
        },
        [onScan, toast]
    )

    // -------------------------------------------------------------------------
    // Camera Management
    // -------------------------------------------------------------------------

    const getErrorMessage = useCallback((errorName: string, retryCount: number): string | null => {
        switch (errorName) {
            case CAMERA_ERRORS.NOT_ALLOWED:
                return 'Camera permission denied. Please allow camera access in your browser settings.'
            case CAMERA_ERRORS.NOT_READABLE:
                if (retryCount < CONFIG.MAX_CAMERA_RETRIES) {
                    return `Camera is in use by another app. Retrying... (${retryCount + 1}/${CONFIG.MAX_CAMERA_RETRIES})`
                }
                return 'Camera remains busy. Please close other apps and try again.'
            case CAMERA_ERRORS.NOT_FOUND:
                return 'No camera found on this device.'
            default:
                return 'Could not access camera. Please ensure you have granted camera permissions.'
        }
    }, [])

    const startCamera = useCallback(
        async (preferredCamera: FacingMode = facingMode) => {
            setError(null)

            if (!videoRef.current) {
                // retry if video element not ready (react mounting race condition)
                if (videoElementRetryCountRef.current < CONFIG.MAX_VIDEO_ELEMENT_RETRIES) {
                    videoElementRetryCountRef.current++
                    setTimeout(() => {
                        if (isScanningRef.current) startCamera(preferredCamera)
                    }, CONFIG.VIDEO_ELEMENT_RETRY_DELAY_MS)
                    return
                }
                setError('Video element not available')
                videoElementRetryCountRef.current = 0
                return
            }

            // reset retry counter on success
            videoElementRetryCountRef.current = 0

            try {
                cleanup()

                // iOS needs a delay to release camera hardware
                if (deviceType === DeviceType.IOS) {
                    await new Promise((resolve) => setTimeout(resolve, CONFIG.IOS_CAMERA_DELAY_MS))
                }

                const scanner = new QrScannerLib(videoRef.current, (result) => handleQRScan(result.data), {
                    ...SCANNER_OPTIONS,
                    preferredCamera,
                })

                // Enable scanning both normal and inverted QR codes (dark on light AND light on dark)
                scanner.setInversionMode('both')

                scannerRef.current = scanner
                await scanner.start()
                console.log('[QR Scanner] Camera started, ready to scan')
                retryCountRef.current = 0
            } catch (err: any) {
                console.error('Error accessing camera:', err)

                const shouldRetry =
                    err.name === CAMERA_ERRORS.NOT_READABLE && retryCountRef.current < CONFIG.MAX_CAMERA_RETRIES

                setError(getErrorMessage(err.name, retryCountRef.current))

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
        [facingMode, deviceType, cleanup, handleQRScan, getErrorMessage, isScanning]
    )

    const toggleCamera = useCallback(async () => {
        if (!scannerRef.current || !isScanning) return

        const newFacingMode: FacingMode = facingMode === 'user' ? 'environment' : 'user'

        try {
            await scannerRef.current.setCamera(newFacingMode)
            setFacingMode(newFacingMode)
        } catch (err) {
            console.error('Error switching camera:', err)
            setError('Failed to switch camera. Please try again.')
        }
    }, [facingMode, isScanning])

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
        isScanning,
        videoRef,
        close,
        toggleCamera,
    }
}

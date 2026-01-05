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
    IOS_CAMERA_DELAY_MS: 100,
    SCANNER_MAX_SCANS_PER_SECOND: 10,
    SCANNER_CLOSE_DELAY_MS: 1500,
} as const

const CAMERA_ERRORS = {
    NOT_ALLOWED: 'NotAllowedError',
    NOT_READABLE: 'NotReadableError',
    NOT_FOUND: 'NotFoundError',
} as const

const SCANNER_OPTIONS = {
    returnDetailedScanResult: true,
    highlightScanRegion: false,
    highlightCodeOutline: false,
    maxScansPerSecond: CONFIG.SCANNER_MAX_SCANS_PER_SECOND,
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

interface ScannerRefs {
    video: React.RefObject<HTMLVideoElement>
    scanner: React.MutableRefObject<QrScannerLib | null>
    retryCount: React.MutableRefObject<number>
}

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

    const refs: ScannerRefs = {
        video: useRef<HTMLVideoElement>(null),
        scanner: useRef<QrScannerLib | null>(null),
        retryCount: useRef<number>(0),
    }

    // -------------------------------------------------------------------------
    // Scanner Lifecycle
    // -------------------------------------------------------------------------

    const cleanup = useCallback(() => {
        if (refs.scanner.current) {
            refs.scanner.current.stop()
            refs.scanner.current.destroy()
            refs.scanner.current = null
        }
        if (refs.video.current) {
            // Critical for iOS to stop camera recording
            refs.video.current.pause()
            refs.video.current.srcObject = null
            refs.video.current.load()
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
            refs.scanner.current?.stop()

            try {
                const result = await onScan(data)

                if (result.success) {
                    toast.info('QR code recognized')
                } else {
                    toast.error(result.error || 'QR code processing failed')
                    processingQRRef.current = false
                    // Resume scanner on failure so user can try again
                    refs.scanner.current?.start()
                }
            } catch (err) {
                console.error('Error processing QR code:', err)
                toast.error('Error processing QR code')
                processingQRRef.current = false
                // Resume scanner on error so user can try again
                refs.scanner.current?.start()
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

            if (!refs.video.current) {
                setError('Video element not available')
                return
            }

            try {
                cleanup()

                // iOS needs a delay to release camera hardware
                if (deviceType === DeviceType.IOS) {
                    await new Promise((resolve) => setTimeout(resolve, CONFIG.IOS_CAMERA_DELAY_MS))
                }

                const scanner = new QrScannerLib(refs.video.current, (result) => handleQRScan(result.data), {
                    ...SCANNER_OPTIONS,
                    preferredCamera,
                })

                refs.scanner.current = scanner
                await scanner.start()
                refs.retryCount.current = 0
            } catch (err: any) {
                console.error('Error accessing camera:', err)

                const shouldRetry =
                    err.name === CAMERA_ERRORS.NOT_READABLE && refs.retryCount.current < CONFIG.MAX_CAMERA_RETRIES

                setError(getErrorMessage(err.name, refs.retryCount.current))

                if (shouldRetry) {
                    refs.retryCount.current++
                    setTimeout(() => {
                        if (isScanning) startCamera(preferredCamera)
                    }, CONFIG.CAMERA_RETRY_DELAY_MS)
                } else {
                    refs.retryCount.current = 0
                }
            }
        },
        [facingMode, deviceType, cleanup, handleQRScan, getErrorMessage, isScanning]
    )

    const toggleCamera = useCallback(async () => {
        if (!refs.scanner.current || !isScanning) return

        const newFacingMode: FacingMode = facingMode === 'user' ? 'environment' : 'user'

        try {
            await refs.scanner.current.setCamera(newFacingMode)
            setFacingMode(newFacingMode)
        } catch (err) {
            console.error('Error switching camera:', err)
            setError('Failed to switch camera. Please try again.')
        }
    }, [facingMode, isScanning])

    // -------------------------------------------------------------------------
    // Effects
    // -------------------------------------------------------------------------

    // Handle visibility change - pause camera when app goes to background
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                refs.scanner.current?.stop()
            } else if (isScanning && refs.scanner.current) {
                refs.scanner.current.start()
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
        videoRef: refs.video,
        close,
        toggleCamera,
    }
}

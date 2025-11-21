import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/0_Bruddle/Toast'
import { Button } from '@/components/0_Bruddle'
import Icon from '@/components/Global/Icon'
import { createPortal } from 'react-dom'
import QrScannerLib from 'qr-scanner'
import { useDeviceType, DeviceType } from '@/hooks/useGetDeviceType'
import { MERCADO_PAGO, PIX } from '@/assets/payment-apps'
import { PEANUTMAN_LOGO } from '@/assets/peanut'
import { ETHEREUM_ICON } from '@/assets/icons'
import Image from 'next/image'

// QR Scanner Configuration
const CAMERA_RETRY_DELAY_MS = 1000
const MAX_CAMERA_RETRIES = 3
const IOS_CAMERA_DELAY_MS = 100
const SCANNER_MAX_SCANS_PER_SECOND = 10
const SCANNER_CLOSE_DELAY_MS = 1500

// Camera error types
const CAMERA_ERRORS = {
    NOT_ALLOWED: 'NotAllowedError',
    NOT_READABLE: 'NotReadableError',
    NOT_FOUND: 'NotFoundError',
} as const

// Scanner configuration
const SCANNER_CONFIG = {
    returnDetailedScanResult: true,
    highlightScanRegion: false,
    highlightCodeOutline: false,
    maxScansPerSecond: SCANNER_MAX_SCANS_PER_SECOND,
} as const

// Supported payment methods
const PAYMENT_METHODS = [
    { src: PEANUTMAN_LOGO, alt: 'Peanut', name: 'Peanut' },
    { src: MERCADO_PAGO, alt: 'Mercado Pago', name: 'Mercado Pago' },
    { src: PIX, alt: 'PIX', name: 'PIX' },
    { src: ETHEREUM_ICON, alt: 'Ethereum and EVMs', name: 'ETH & EVMs' },
] as const

// Corner positions for scan region overlay
const CORNER_POSITIONS = [
    { className: 'absolute -left-1 -top-1', rotation: '' },
    { className: 'absolute -right-1 -top-1', rotation: 'rotate-90' },
    { className: 'absolute -bottom-1 -left-1', rotation: '-rotate-90' },
    { className: 'absolute -bottom-1 -right-1', rotation: '-rotate-180' },
] as const

export interface QRScannerProps {
    onScan: (data: string) => Promise<{ success: boolean; error?: string }>
    onClose?: () => void
    isOpen?: boolean
}

function PinkCorner({ className }: { className?: string }) {
    return (
        <svg className={className} width="45" height="45" viewBox="0 0 45 45" fill="none">
            <path
                d="M42.455 3.502C9.65 2.215 1.533 11.018 3.595 42.376"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                className="text-primary-1"
            />
        </svg>
    )
}

function PayMethodLogo({ src, alt, name }: { src: string; alt: string; name: string }) {
    return (
        <div className="flex max-w-26 items-center gap-1">
            <Image src={src} alt={alt} height={24} priority />
            <span className="break-normal text-left text-xs font-black uppercase leading-none tracking-wider text-white">
                {name}
            </span>
        </div>
    )
}

export default function QRScanner({ onScan, onClose, isOpen = true }: QRScannerProps) {
    const [error, setError] = useState<string | null>(null)
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
    const [isScanning, setIsScanning] = useState(isOpen)
    const [processingQR, setProcessingQR] = useState(false)
    const toast = useToast()
    const { deviceType } = useDeviceType()
    const videoRef = useRef<HTMLVideoElement>(null)
    const scannerRef = useRef<QrScannerLib | null>(null)
    const retryCountRef = useRef<number>(0)

    // Centralized cleanup function for scanner and video resources
    const cleanupScanner = useCallback(() => {
        if (scannerRef.current) {
            scannerRef.current.stop()
            scannerRef.current.destroy()
            scannerRef.current = null
        }
        if (videoRef.current) {
            videoRef.current.pause() // Critical for iOS to stop camera recording
            videoRef.current.srcObject = null
            videoRef.current.load()
        }
    }, [])

    // Reset retry counter
    const resetRetryCount = useCallback(() => {
        retryCountRef.current = 0
    }, [])

    // Handle camera errors with retry logic
    const handleCameraError = useCallback(
        (error: any) => {
            console.error('Error accessing camera:', error)

            switch (error.name) {
                case CAMERA_ERRORS.NOT_ALLOWED:
                    setError('Camera permission denied. Please allow camera access in your browser settings.')
                    resetRetryCount()
                    break

                case CAMERA_ERRORS.NOT_READABLE:
                    if (retryCountRef.current < MAX_CAMERA_RETRIES) {
                        retryCountRef.current++
                        setError(
                            `Camera is in use by another app. Retrying... (${retryCountRef.current}/${MAX_CAMERA_RETRIES})`
                        )
                        setTimeout(() => {
                            if (isScanning) {
                                startCamera()
                            }
                        }, CAMERA_RETRY_DELAY_MS)
                    } else {
                        setError('Camera remains busy. Please close other apps and try again.')
                        resetRetryCount()
                    }
                    break

                case CAMERA_ERRORS.NOT_FOUND:
                    setError('No camera found on this device.')
                    resetRetryCount()
                    break

                default:
                    setError('Could not access camera. Please ensure you have granted camera permissions.')
                    resetRetryCount()
            }
        },
        [isScanning, resetRetryCount]
    )

    const handleQRScan = useCallback(
        async (data: string) => {
            if (processingQR) return

            try {
                setProcessingQR(true)
                const result = await onScan(data)

                if (result.success) {
                    toast.info('QR code recognized')
                } else {
                    toast.error(result.error || 'QR code processing failed')
                    setProcessingQR(false)
                }
            } catch (error) {
                console.error('Error processing QR code:', error)
                toast.error('Error processing QR code')
                setProcessingQR(false)
            }
        },
        [processingQR, onScan, toast]
    )

    const closeScanner = useCallback(() => {
        try {
            cleanupScanner()
            setIsScanning(false)
            onClose?.()
        } catch (error) {
            console.error('Error closing QR scanner:', error)
        }
    }, [onClose, cleanupScanner])

    const startCamera = useCallback(async () => {
        setError(null)

        if (!videoRef.current) {
            setError('Video element not available')
            return
        }

        try {
            // Clean up any existing scanner
            cleanupScanner()

            // iOS-specific delay to release camera hardware
            if (deviceType === DeviceType.IOS) {
                await new Promise((resolve) => setTimeout(resolve, IOS_CAMERA_DELAY_MS))
            }

            // Create and start new scanner
            const scanner = new QrScannerLib(
                videoRef.current,
                (result) => {
                    if (!processingQR) {
                        handleQRScan(result.data)
                    }
                },
                {
                    ...SCANNER_CONFIG,
                    preferredCamera: facingMode,
                }
            )

            scannerRef.current = scanner
            await scanner.start()
            resetRetryCount()
        } catch (error: any) {
            handleCameraError(error)
        }
    }, [facingMode, deviceType, handleQRScan, processingQR, cleanupScanner, resetRetryCount, handleCameraError])

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

    // Toggle camera facing mode
    const toggleCamera = useCallback(async () => {
        const newFacingMode = facingMode === 'user' ? 'environment' : 'user'

        if (scannerRef.current && isScanning) {
            try {
                // Use the scanner's built-in setCamera method (doesn't require new permissions)
                await scannerRef.current.setCamera(newFacingMode)
                // Only update state after successful camera switch
                setFacingMode(newFacingMode)
            } catch (error) {
                console.error('Error toggling camera:', error)
                // If setCamera fails, try restarting the scanner with new facing mode
                setFacingMode(newFacingMode)
            }
        }
    }, [facingMode, isScanning])

    // Start or stop scanner based on isScanning state
    useEffect(() => {
        if (isScanning) {
            startCamera()
        } else {
            cleanupScanner()
        }
    }, [isScanning, startCamera, cleanupScanner])

    // Handle isOpen prop changes
    useEffect(() => {
        if (!isOpen) {
            setTimeout(closeScanner, SCANNER_CLOSE_DELAY_MS)
        } else {
            setIsScanning(isOpen)
        }
    }, [isOpen, closeScanner])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanupScanner()
        }
    }, [cleanupScanner])

    if (!isScanning) {
        return null
    }

    return createPortal(
        <div className="qr-scanner-container fixed left-0 top-0 z-50 flex h-full w-full flex-col bg-black">
            {error ? (
                <div className="p-4 text-center text-white">
                    <p className="text-red-500">{error}</p>
                    <button onClick={closeScanner} className="mt-4 rounded bg-white px-4 py-2 text-black">
                        Close
                    </button>
                </div>
            ) : (
                <>
                    <video
                        ref={videoRef}
                        id="camera-video"
                        className="h-full w-full object-cover"
                        autoPlay
                        playsInline
                        muted
                    />
                    <div className="fixed left-0 top-8 z-50 grid w-full grid-flow-col items-center py-2 text-center text-white">
                        <Button
                            variant="transparent-light"
                            className="border-1 mx-auto flex h-8 w-8 items-center justify-center border-white p-0"
                            onClick={closeScanner}
                        >
                            <Icon name="close" fill="white" />
                        </Button>
                        <span className="text-3xl font-extrabold">Scan to pay</span>
                        <Button
                            variant="transparent-light"
                            className="border-1 mx-auto flex h-8 w-8 items-center justify-center border-white p-0"
                            onClick={toggleCamera}
                        >
                            <Icon name="flip-camera" fill="white" height={24} width={24} />
                        </Button>
                    </div>
                    <div className="fixed left-1/2 flex h-64 w-64 -translate-x-1/2 translate-y-1/2 justify-center">
                        <div className="absolute inset-0">
                            <div className="absolute inset-0 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.8)]" />
                            {CORNER_POSITIONS.map((corner, index) => (
                                <PinkCorner key={index} className={`${corner.className} ${corner.rotation}`} />
                            ))}
                        </div>
                        <div className="flex-column z-50 translate-y-[100%] transform items-center text-center">
                            <div className="mt-10 flex flex-wrap justify-center gap-2">
                                {PAYMENT_METHODS.map((method) => (
                                    <PayMethodLogo key={method.name} {...method} />
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>,
        document.body
    )
}

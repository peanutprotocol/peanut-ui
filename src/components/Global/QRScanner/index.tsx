import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/0_Bruddle/Toast'
import { Button } from '@/components/0_Bruddle/Button'
import Icon from '@/components/Global/Icon'
import { createPortal } from 'react-dom'
import jsQR from 'jsqr'
import { useDeviceType, DeviceType } from '@/hooks/useGetDeviceType'
import { MERCADO_PAGO, PIX } from '@/assets/payment-apps'
import { PEANUTMAN_LOGO } from '@/assets/peanut'
import { ETHEREUM_ICON } from '@/assets/icons'
import Image from 'next/image'

// QR Scanner Configuration
const QR_SCAN_INTERVAL_MS = 100 // Scan every 100ms (10 times per second)
const CAMERA_RETRY_DELAY_MS = 1000 // Wait 1 second before retrying camera access
const MAX_CAMERA_RETRIES = 3 // Maximum number of retry attempts for busy camera
const IOS_CAMERA_DELAY_MS = 100 // iOS-specific delay for camera hardware release
const IDEAL_CAMERA_WIDTH = 1280 // Ideal camera resolution width (720p)
const IDEAL_CAMERA_HEIGHT = 720 // Ideal camera resolution height (720p)

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
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const scanIntervalRef = useRef<number | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const retryCountRef = useRef<number>(0)
    const stopCamera = useCallback(() => {
        if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current)
            scanIntervalRef.current = null
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
            streamRef.current = null
        }
        if (videoRef.current) {
            videoRef.current.pause() // Explicitly pause video element (critical for iOS)
            videoRef.current.srcObject = null
            videoRef.current.load()
        }
    }, [])
    const closeScanner = useCallback(() => {
        try {
            stopCamera()
            setIsScanning(false)
            onClose?.()
        } catch (error) {
            console.error('Error closing QR scanner:', error)
        }
    }, [onClose, stopCamera])
    const handleQRScan = async (data: string) => {
        try {
            setProcessingQR(true)
            const result = await onScan(data)
            if (result.success) {
                toast.info('QR code recognized')
            } else {
                toast.error(result.error || 'QR code processing failed')
                // Resume scanning
                setProcessingQR(false)
            }
        } catch (error) {
            console.error('Error processing QR code:', error)
            toast.error('Error processing QR code')
            setProcessingQR(false)
        }
    }
    const setupQRScanning = () => {
        if (!videoRef.current || !canvasRef.current) return
        const video = videoRef.current
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Clear any existing scan interval
        if (scanIntervalRef.current !== null) {
            clearInterval(scanIntervalRef.current)
        }

        // Start scanning at regular intervals
        scanIntervalRef.current = window.setInterval(() => {
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                canvas.height = video.videoHeight
                canvas.width = video.videoWidth
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

                try {
                    const code = jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: 'attemptBoth',
                    })

                    if (code) {
                        handleQRScan(code.data)
                    }
                } catch (err) {
                    console.error('Error scanning QR code:', err)
                }
            }
        }, QR_SCAN_INTERVAL_MS)
    }
    const startCamera = useCallback(async () => {
        setError(null)
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                // Stop any existing stream
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach((track) => track.stop())
                    streamRef.current = null
                }

                // Give iOS time to release camera hardware (iOS-specific fix)
                if (deviceType === DeviceType.IOS) {
                    await new Promise((resolve) => setTimeout(resolve, IOS_CAMERA_DELAY_MS))
                }

                // Request camera with specified facing mode
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode,
                        width: { ideal: IDEAL_CAMERA_WIDTH },
                        height: { ideal: IDEAL_CAMERA_HEIGHT },
                    },
                })

                streamRef.current = stream

                // Reset retry count on successful camera start
                retryCountRef.current = 0

                if (videoRef.current) {
                    videoRef.current.srcObject = stream

                    // Wait for video to be ready before setting up QR scanning
                    videoRef.current.onloadedmetadata = () => {
                        setupQRScanning()
                    }
                }
            } catch (error: any) {
                console.error('Error accessing camera:', error)

                // Specific error handling based on error type
                if (error.name === 'NotAllowedError') {
                    setError('Camera permission denied. Please allow camera access in your browser settings.')
                    retryCountRef.current = 0 // Reset on permission error
                } else if (error.name === 'NotReadableError') {
                    // Camera is busy - retry with limit
                    if (retryCountRef.current < MAX_CAMERA_RETRIES) {
                        retryCountRef.current++
                        setError(
                            `Camera is in use by another app. Retrying... (${retryCountRef.current}/${MAX_CAMERA_RETRIES})`
                        )

                        // Retry after delay (camera might be released)
                        setTimeout(() => {
                            if (isScanning) {
                                startCamera()
                            }
                        }, CAMERA_RETRY_DELAY_MS)
                    } else {
                        setError('Camera remains busy. Please close other apps and try again.')
                        retryCountRef.current = 0 // Reset for next attempt
                    }
                } else if (error.name === 'NotFoundError') {
                    setError('No camera found on this device.')
                    retryCountRef.current = 0
                } else {
                    setError('Could not access camera. Please ensure you have granted camera permissions.')
                    retryCountRef.current = 0
                }
            }
        } else {
            setError('Your browser does not support camera access')
        }
    }, [facingMode, isScanning, deviceType])
    // Handle visibility change - pause camera when app goes to background
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                stopCamera()
            } else if (isScanning) {
                startCamera()
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [isScanning, startCamera, stopCamera])
    // Toggle camera facing mode
    const toggleCamera = useCallback(() => {
        const newFacingMode = facingMode === 'user' ? 'environment' : 'user'
        setFacingMode(newFacingMode)
    }, [facingMode])
    // Start or stop scanner based on isScanning state
    useEffect(() => {
        if (isScanning) {
            startCamera()
        } else {
            // Clean up on scanner close - call stopCamera to ensure proper cleanup including video.pause()
            stopCamera()
        }
    }, [isScanning, startCamera, stopCamera])

    useEffect(() => {
        if (!isOpen) {
            setTimeout(closeScanner, 1500)
        } else {
            setIsScanning(isOpen)
        }
    }, [isOpen, closeScanner])

    // Cleanup function to stop camera when the component unmounts
    useEffect(() => {
        return () => {
            // Directly call stopCamera to avoid stale closure issues
            if (scanIntervalRef.current) {
                clearInterval(scanIntervalRef.current)
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop())
            }
            if (videoRef.current) {
                videoRef.current.pause() // Critical for iOS to stop camera recording
                videoRef.current.srcObject = null
            }
        }
    }, [])

    if (!isScanning) {
        return null
    }
    // Render the QR scanner UI using React Portal
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
                    />
                    <canvas ref={canvasRef} className="hidden" />
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
                            {/* Top-left corner */}
                            <PinkCorner className="absolute -left-1 -top-1" />

                            {/* Top-right corner */}
                            <PinkCorner className="absolute -right-1 -top-1 rotate-90" />

                            {/* Bottom-left corner */}
                            <PinkCorner className="absolute -bottom-1 -left-1 -rotate-90" />

                            {/* Bottom-right corner */}
                            <PinkCorner className="absolute -bottom-1 -right-1 -rotate-180" />
                        </div>
                        <div className="flex-column z-50 translate-y-[100%] transform items-center text-center">
                            <div className="mt-10 flex flex-wrap justify-center gap-2">
                                <PayMethodLogo src={PEANUTMAN_LOGO} alt="Peanut" name="Peanut" />
                                <PayMethodLogo src={MERCADO_PAGO} alt="Mercado Pago" name="Mercado Pago" />
                                <PayMethodLogo src={PIX} alt="PIX" name="PIX" />
                                <PayMethodLogo src={ETHEREUM_ICON} alt="Ethereum and EVMs" name="ETH & EVMs" />
                                {/*
                                    Enable once we have confirmation of merchant support for arbitrum
                                <PayMethodLogo src={SIMPLEFI} alt="Simplefi" name="Simplefi" />
                                */}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>,
        document.body
    )
}

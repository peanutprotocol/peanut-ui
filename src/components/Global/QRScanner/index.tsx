'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/0_Bruddle/Toast'
import { Button } from '@/components/0_Bruddle'
import { createPortal } from 'react-dom'
import jsQR from 'jsqr'

export interface QRScannerProps {
    onScan: (data: string) => Promise<{ success: boolean; error?: string }>
    onClose?: () => void
    isOpen?: boolean
}

export default function QRScanner({ onScan, onClose, isOpen = true }: QRScannerProps) {
    const [error, setError] = useState<string | null>(null)
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
    const [isScanning, setIsScanning] = useState(isOpen)
    const [processingQR, setProcessingQR] = useState(false)
    const [statusMessage, setStatusMessage] = useState('Scanning for QR codes...')
    const toast = useToast()
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const scanIntervalRef = useRef<number | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const closeScanner = useCallback(() => {
        try {
            // Stop QR scanning interval
            if (scanIntervalRef.current) {
                clearInterval(scanIntervalRef.current)
                scanIntervalRef.current = null
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop())
                streamRef.current = null
            }
            setIsScanning(false)
            onClose?.()
        } catch (error) {
            console.error('Error closing QR scanner:', error)
        }
    }, [onClose])
    const handleQRScan = useCallback(
        async (data: string) => {
            if (processingQR) return
            try {
                setProcessingQR(true)
                setStatusMessage('QR Code Found! Processing...')
                const result = await onScan(data)
                if (result.success) {
                    toast.info('QR code recognized')
                    closeScanner()
                } else {
                    setStatusMessage("We dont't support this QR code yet")
                    toast.error(result.error || 'QR code processing failed')
                    // Resume scanning
                    setProcessingQR(false)
                }
            } catch (error) {
                console.error('Error processing QR code:', error)
                toast.error('Error processing QR code')
                setStatusMessage('Scanning for QR codes...')
                setProcessingQR(false)
            }
        },
        [closeScanner, onScan, processingQR, toast]
    )
    const setupQRScanning = useCallback(() => {
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
                        inversionAttempts: 'dontInvert',
                    })

                    if (code && !processingQR) {
                        handleQRScan(code.data)
                    }
                } catch (err) {
                    console.error('Error scanning QR code:', err)
                }
            }
        }, 500)
    }, [handleQRScan, processingQR])
    const startCamera = useCallback(async () => {
        setError(null)
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                // Stop any existing stream
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach((track) => track.stop())
                }

                // Request camera with specified facing mode
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode },
                })

                streamRef.current = stream

                if (videoRef.current) {
                    videoRef.current.srcObject = stream

                    // Wait for video to be ready before setting up QR scanning
                    videoRef.current.onloadedmetadata = () => {
                        setupQRScanning()
                    }
                }
            } catch (error) {
                console.error('Error accessing camera:', error)
                setError('Could not access camera. Please ensure you have granted camera permissions.')
            }
        } else {
            setError('Your browser does not support camera access')
        }
    }, [facingMode, setupQRScanning])
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
            // Clean up on scanner close
            if (scanIntervalRef.current) {
                clearInterval(scanIntervalRef.current)
                scanIntervalRef.current = null
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop())
                streamRef.current = null
            }
        }

        // Cleanup on component unmount
        return () => {
            if (scanIntervalRef.current) {
                clearInterval(scanIntervalRef.current)
                scanIntervalRef.current = null
            }

            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop())
                streamRef.current = null
            }
        }
    }, [isScanning, startCamera])
    // Handle initial isOpen prop
    useEffect(() => {
        setIsScanning(isOpen)
    }, [isOpen])
    // Handle facing mode change
    useEffect(() => {
        if (isScanning && streamRef.current) {
            startCamera()
        }
    }, [facingMode, isScanning, startCamera])

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
                    Copy <canvas ref={canvasRef} className="hidden" />
                    <div className="fixed left-0 top-8 w-full bg-black bg-opacity-50 py-2 text-center text-white">
                        {statusMessage}
                    </div>
                    <div className="fixed left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 transform rounded-lg border-2 border-white" />
                    <div className="fixed bottom-0 left-0 z-[60] flex w-full justify-between p-4">
                        <Button onClick={closeScanner}>Close</Button>

                        <Button onClick={toggleCamera}>Flip Camera</Button>
                    </div>
                </>
            )}
        </div>,
        document.body
    )
}

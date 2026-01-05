import { createPortal } from 'react-dom'
import { Button } from '@/components/0_Bruddle/Button'
import { MERCADO_PAGO, PIX } from '@/assets/payment-apps'
import { PEANUTMAN_LOGO } from '@/assets/peanut'
import { ETHEREUM_ICON } from '@/assets/icons'
import Image from 'next/image'
import { Icon } from '../Icons/Icon'
import { useQRScanner, type QRScanHandler } from './useQRScanner'

// ============================================================================
// Configuration
// ============================================================================

const PAYMENT_METHODS = [
    { src: PEANUTMAN_LOGO, alt: 'Peanut', name: 'Peanut' },
    { src: MERCADO_PAGO, alt: 'Mercado Pago', name: 'Mercado Pago' },
    { src: PIX, alt: 'PIX', name: 'PIX' },
    { src: ETHEREUM_ICON, alt: 'Ethereum and EVMs', name: 'ETH & EVMs' },
] as const

const CORNER_POSITIONS = [
    { position: '-left-1 -top-1', rotation: '' },
    { position: '-right-1 -top-1', rotation: 'rotate-90' },
    { position: '-bottom-1 -left-1', rotation: '-rotate-90' },
    { position: '-bottom-1 -right-1', rotation: '-rotate-180' },
] as const

// ============================================================================
// Types
// ============================================================================

export interface QRScannerProps {
    onScan: QRScanHandler
    onClose?: () => void
    isOpen?: boolean
}

// ============================================================================
// Sub-components
// ============================================================================

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

function PaymentMethodBadge({ src, alt, name }: { src: string; alt: string; name: string }) {
    return (
        <div className="flex max-w-26 items-center gap-1">
            <Image src={src} alt={alt} height={24} priority />
            <span className="break-normal text-left text-xs font-black uppercase leading-none tracking-wider text-white">
                {name}
            </span>
        </div>
    )
}

function ScannerControls({ onClose, onToggleCamera }: { onClose: () => void; onToggleCamera: () => void }) {
    return (
        <div className="fixed left-0 top-8 z-50 grid w-full grid-flow-col items-center py-2 text-center text-white">
            <Button
                variant="transparent-light"
                className="border-1 mx-auto flex h-8 w-8 items-center justify-center border-white p-0"
                onClick={onClose}
            >
                <Icon name="cancel" fill="white" />
            </Button>
            <span className="text-3xl font-extrabold">Scan to pay</span>
            <Button
                variant="transparent-light"
                className="border-1 mx-auto flex h-8 w-8 items-center justify-center border-white p-0"
                onClick={onToggleCamera}
            >
                <Icon name="camera-flip" fill="white" height={24} width={24} />
            </Button>
        </div>
    )
}

function ScanRegionOverlay() {
    return (
        <div className="fixed left-1/2 flex h-64 w-64 -translate-x-1/2 translate-y-1/2 justify-center">
            {/* Darkened background with transparent scan region */}
            <div className="absolute inset-0">
                <div className="absolute inset-0 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.8)]" />
                {CORNER_POSITIONS.map(({ position, rotation }, index) => (
                    <PinkCorner key={index} className={`absolute ${position} ${rotation}`} />
                ))}
            </div>

            {/* Supported payment methods */}
            <div className="flex-column z-50 translate-y-[100%] transform items-center text-center">
                <div className="mt-10 flex flex-wrap justify-center gap-2">
                    {PAYMENT_METHODS.map((method) => (
                        <PaymentMethodBadge key={method.name} {...method} />
                    ))}
                </div>
            </div>
        </div>
    )
}

function ErrorView({ message, onClose }: { message: string; onClose: () => void }) {
    return (
        <div className="p-4 text-center text-white">
            <p className="text-red-500">{message}</p>
            <button onClick={onClose} className="mt-4 rounded bg-white px-4 py-2 text-black">
                Close
            </button>
        </div>
    )
}

// ============================================================================
// Main Component
// ============================================================================

export default function QRScanner({ onScan, onClose, isOpen = true }: QRScannerProps) {
    const { error, isScanning, videoRef, close, toggleCamera } = useQRScanner(onScan, onClose, isOpen)

    if (!isScanning) return null

    return createPortal(
        <div className="qr-scanner-container fixed left-0 top-0 z-50 flex h-full w-full flex-col bg-black">
            {error ? (
                <ErrorView message={error} onClose={close} />
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
                    <ScannerControls onClose={close} onToggleCamera={toggleCamera} />
                    <ScanRegionOverlay />
                </>
            )}
        </div>,
        document.body
    )
}

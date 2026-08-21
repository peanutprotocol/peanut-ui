import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { MERCADO_PAGO, PIX } from '@/assets/payment-apps'
import { PEANUTMAN } from '@/assets/mascot'
import { ETHEREUM_ICON } from '@/assets/icons'
import Image from 'next/image'
import { Icon } from '../Icons/Icon'
import { useQRScanner, type QRScanHandler } from './useQRScanner'
import { useToast } from '@/components/0_Bruddle/Toast'
import CameraPermissionModal from './CameraPermissionModal'
import { Clipboard } from '@capacitor/clipboard'
import { clipboardHasStrings } from '@/utils/clipboard-detect'
import { extractPaymentValue, readClipboard } from '@/utils/clipboard-extract.utils'
import { isAndroidNative } from '@/utils/capacitor'
import { printableAddress } from '@/utils/general.utils'

// ============================================================================
// Configuration
// ============================================================================

// Brand names stay verbatim — they are proper nouns in every locale. The EVM
// row is the odd one out: its label and alt text are descriptive prose, so it
// carries a key instead and is resolved at render.
const PAYMENT_METHODS = [
    { src: PEANUTMAN, alt: 'Peanut', name: 'Peanut' },
    { src: MERCADO_PAGO, alt: 'Mercado Pago', name: 'Mercado Pago' },
    { src: PIX, alt: 'PIX', name: 'PIX' },
    { src: ETHEREUM_ICON, alt: null, name: null },
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
                className="text-action-primary"
            />
        </svg>
    )
}

function PaymentMethodBadge({ src, alt, name }: { src: string; alt: string; name: string }) {
    return (
        <div className="flex max-w-26 items-center gap-1">
            <Image src={src} alt={alt} height={24} priority />
            <span className="text-left text-body-xs leading-none font-black tracking-wider break-normal text-white uppercase">
                {name}
            </span>
        </div>
    )
}

function ScannerControls({ onClose, onToggleCamera }: { onClose: () => void; onToggleCamera: () => void }) {
    const t = useTranslations('global')
    return (
        // portalled overlay escapes the layout's safe-area padding; max() keeps the old 2.5rem on web
        <div className="fixed top-0 left-0 z-50 grid w-full grid-flow-col items-center pt-[max(2.5rem,calc(var(--safe-top)_+_0.5rem))] pb-2 text-center text-white">
            <Button
                variant="transparent-light"
                className="mx-auto flex h-8 w-8 items-center justify-center border-white p-0"
                onClick={onClose}
            >
                <Icon name="cancel" size={18} fill="white" />
            </Button>
            <span className="text-heading-m text-foreground-inverse">{t('qrScanner.scanToPay')}</span>
            <Button
                variant="transparent-light"
                className="mx-auto flex h-8 w-8 items-center justify-center border-white p-0"
                onClick={onToggleCamera}
            >
                <Icon name="camera-flip" fill="white" height={24} width={24} />
            </Button>
        </div>
    )
}

function PasteActions({
    onPaste,
    detectedAddress,
    onUseDetected,
    showPasteChip,
    onUsePasteChip,
}: {
    onPaste: () => void
    detectedAddress: string | null
    onUseDetected: () => void
    showPasteChip: boolean
    onUsePasteChip: () => void
}) {
    const t = useTranslations('global')
    return (
        <>
            <button
                onClick={onPaste}
                className="justify mx-auto mt-10 flex items-center gap-1.5 text-center text-white underline underline-offset-2"
            >
                <Icon name="paste" fill="white" height={16} width={16} />
                <span className="text-body-s">{t('qrScanner.clickToPaste')}</span>
            </button>
            {detectedAddress ? (
                <button
                    onClick={onUseDetected}
                    className="mx-auto mt-3 flex items-center gap-1.5 rounded-full border border-white/40 px-3 py-1.5 text-white"
                >
                    <Icon name="wallet" fill="white" height={16} width={16} />
                    <span className="text-body-s font-semibold">{printableAddress(detectedAddress)}</span>
                </button>
            ) : showPasteChip ? (
                <button
                    onClick={onUsePasteChip}
                    className="mx-auto mt-3 flex items-center gap-1.5 rounded-full border border-white/40 px-3 py-1.5 text-white"
                >
                    <Icon name="paste" fill="white" height={16} width={16} />
                    <span className="text-body-s font-semibold">{t('qrScanner.useCopiedCode')}</span>
                </button>
            ) : null}
        </>
    )
}

function ScanRegionOverlay({
    onPaste,
    detectedAddress,
    onUseDetected,
    showPasteChip,
    onUsePasteChip,
}: {
    onPaste: () => void
    detectedAddress: string | null
    onUseDetected: () => void
    showPasteChip: boolean
    onUsePasteChip: () => void
}) {
    const t = useTranslations('global')
    return (
        <div className="fixed left-1/2 flex h-64 w-64 -translate-x-1/2 translate-y-1/2 justify-center">
            {/* Darkened background with transparent scan region */}
            <div className="absolute inset-0">
                <div className="absolute inset-0 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.8)]" />
                {CORNER_POSITIONS.map(({ position, rotation }, index) => (
                    <PinkCorner key={index} className={`absolute ${position} ${rotation}`} />
                ))}
            </div>

            {/* Supported payment methods and paste option */}
            <div className="flex-column z-50 translate-y-[100%] transform items-center text-center">
                <div className="mt-10 flex flex-wrap justify-center gap-2">
                    {PAYMENT_METHODS.map((method) => (
                        <PaymentMethodBadge
                            key={method.name ?? 'evm'}
                            src={method.src}
                            alt={method.alt ?? t('qrScanner.paymentMethods.evmAlt')}
                            name={method.name ?? t('qrScanner.paymentMethods.evmName')}
                        />
                    ))}
                </div>
                <PasteActions
                    onPaste={onPaste}
                    detectedAddress={detectedAddress}
                    onUseDetected={onUseDetected}
                    showPasteChip={showPasteChip}
                    onUsePasteChip={onUsePasteChip}
                />
            </div>
        </div>
    )
}

function ErrorView({
    message,
    onClose,
    children,
}: {
    message: string
    onClose: () => void
    children?: React.ReactNode
}) {
    const tCommon = useTranslations('common')
    return (
        <div className="p-4 text-center text-white">
            <p className="text-foreground-error">{message}</p>
            <button
                onClick={onClose}
                className="mt-4 rounded-sm bg-background-default px-4 py-2 text-foreground-primary"
            >
                {tCommon('close')}
            </button>
            {children}
        </div>
    )
}

// ============================================================================
// Main Component
// ============================================================================

export default function QRScanner({ onScan, onClose, isOpen = true }: QRScannerProps) {
    const { error, isPermissionDenied, isScanning, isCameraReady, videoRef, close, toggleCamera, retryCamera } =
        useQRScanner(onScan, onClose, isOpen)
    const t = useTranslations('global')
    const toast = useToast()
    const [detectedAddress, setDetectedAddress] = useState<string | null>(null)
    const [showPasteChip, setShowPasteChip] = useState(false)

    /*
     * Platform-split clipboard shortcut. Android native: read at open and
     * preview the copied EVM address — the read only trips the system paste
     * toast, nothing blocking. iOS native: an un-gestured Clipboard.read()
     * raises the "Allow Paste" alert, which raced the camera permission dialog
     * and blocked it (PEANUT-UI-PYW) — so only a prompt-free hasStrings check
     * runs here, and the actual read happens on the chip tap (a real gesture).
     * Web/PWA: no pre-read at all; "Click to paste" remains.
     */
    useEffect(() => {
        if (!isScanning) {
            setDetectedAddress(null)
            setShowPasteChip(false)
            return
        }
        let cancelled = false
        if (isAndroidNative()) {
            Clipboard.read()
                .then(({ value }) => {
                    if (!cancelled) setDetectedAddress(extractPaymentValue((value ?? '').trim(), 'evmAddress'))
                })
                .catch(() => {
                    if (!cancelled) setDetectedAddress(null)
                })
        } else {
            clipboardHasStrings().then((hasStrings) => {
                if (!cancelled) setShowPasteChip(hasStrings)
            })
        }
        return () => {
            cancelled = true
        }
    }, [isScanning])

    // Capacitor Clipboard reads through the native bridge on device (the
    // WebView's navigator.clipboard.readText is unreliable/blocked in the
    // Android WebView); its web shim falls back to navigator.clipboard.
    // Returns trimmed text, or null after toasting the read failure.
    const readClipboardText = async (): Promise<string | null> => {
        const result = await readClipboard()
        if (result.ok) return result.text
        if (result.reason === 'unavailable') console.error('Failed to read clipboard:', result.cause)
        toast.error(t(result.reason === 'empty' ? 'qrScanner.clipboardEmpty' : 'qrScanner.clipboardUnavailable'))
        return null
    }

    // Every tap path funnels onScan through this so a payment/routing failure
    // is reported as a processing error, never as a clipboard problem.
    const scanValue = async (data: string) => {
        try {
            await onScan(data)
        } catch (err) {
            console.error('Error processing QR code:', err)
            toast.error(t('qrScanner.qrProcessingError'))
        }
    }

    /*
     * The iOS chip is a nudge, not a filter: hasStrings() reports only THAT the
     * clipboard has text, never what it is. Extracting an EVM address here and
     * rejecting everything else therefore turned the chip into a dead end for
     * the payloads the scanner exists to accept — a pasted Pix copia-e-cola was
     * refused as "not a wallet address". Hand the raw text to the same scan path
     * as "Click to paste" and let recognizeQr decide.
     */
    const handleUsePasteChip = async () => {
        const text = await readClipboardText()
        if (!text) {
            setShowPasteChip(false)
            return
        }
        await scanValue(text)
    }

    const handlePaste = async () => {
        const text = await readClipboardText()
        if (!text) return
        await scanValue(text)
    }

    if (!isScanning) return null

    return createPortal(
        <div className="qr-scanner-container fixed top-0 left-0 z-50 flex h-full w-full flex-col bg-black">
            {/* modal uses !z-[60] to appear above this z-50 scanner portal (Dialog portals to body) */}
            {isPermissionDenied ? (
                /*
                 * The camera states offer paste too, rather than dead-ending. Pasting a
                 * Pix code needs no camera, but the paste UI lived only in the happy
                 * path — so on native, where the OS camera grant is a sticky
                 * per-install decision, declining it removed the app's only entry point
                 * for a copied Pix code. The modal owns the whole screen here, so the
                 * action has to sit inside it to be reachable.
                 */
                <CameraPermissionModal visible onRetry={retryCamera} onClose={close} onPaste={handlePaste} />
            ) : error ? (
                <ErrorView message={error} onClose={close}>
                    <PasteActions
                        onPaste={handlePaste}
                        detectedAddress={detectedAddress}
                        onUseDetected={() => scanValue(detectedAddress!)}
                        showPasteChip={showPasteChip}
                        onUsePasteChip={handleUsePasteChip}
                    />
                </ErrorView>
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
                    {!isCameraReady && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black">
                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            <span className="text-body-s text-white/80">{t('qrScanner.startingCamera')}</span>
                        </div>
                    )}
                    <ScannerControls onClose={close} onToggleCamera={toggleCamera} />
                    <ScanRegionOverlay
                        onPaste={handlePaste}
                        detectedAddress={detectedAddress}
                        onUseDetected={() => scanValue(detectedAddress!)}
                        showPasteChip={showPasteChip}
                        onUsePasteChip={handleUsePasteChip}
                    />
                </>
            )}
        </div>,
        document.body
    )
}

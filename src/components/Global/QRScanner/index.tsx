import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { QR_DRAWER_PASTE_GAP_PX, QR_DRAWER_PEEK_PX } from '@/constants/qr-drawer.consts'
import { useEffect, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { MERCADO_PAGO, PIX } from '@/assets/payment-apps'
import { PEANUTMAN } from '@/assets/mascot'
import { ETHEREUM_ICON } from '@/assets/icons'
import Image from 'next/image'
import { Icon } from '../Icons/Icon'
import { twMerge } from '@/utils/tw'
import { useQRScanner, type QRScanHandler } from './useQRScanner'
import { useToast } from '@/components/0_Bruddle/Toast'
import CameraPermissionModal from './CameraPermissionModal'
import { Clipboard } from '@capacitor/clipboard'
import { clipboardHasStrings } from '@/utils/clipboard-detect'
import { extractPaymentValue, readClipboard } from '@/utils/clipboard-extract.utils'
import { isAndroidNative } from '@/utils/capacitor'
import { printableAddress } from '@/utils/general.utils'
import { reportQrScanError } from './utils'

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
            <span className="text-left text-label-m leading-none tracking-wider break-normal text-white uppercase">
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
                <Icon name="cancel" size={20} fill="white" />
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
    className,
}: {
    onPaste: () => void
    detectedAddress: string | null
    onUseDetected: () => void
    showPasteChip: boolean
    onUsePasteChip: () => void
    className?: string
}) {
    const t = useTranslations('global')
    return (
        <div className={twMerge('flex flex-col items-center gap-3', className)}>
            <button onClick={onPaste} className="flex items-center gap-1 text-white underline underline-offset-2">
                <Icon name="paste" fill="white" size={16} />
                <span className="text-body-s">{t('qrScanner.clickToPaste')}</span>
            </button>
            {detectedAddress ? (
                <button
                    onClick={onUseDetected}
                    className="flex items-center gap-1 rounded-full border border-white/40 px-3 py-2 text-white"
                >
                    <Icon name="wallet" fill="white" size={16} />
                    <span className="text-label-l">{printableAddress(detectedAddress)}</span>
                </button>
            ) : showPasteChip ? (
                <button
                    onClick={onUsePasteChip}
                    className="flex items-center gap-1 rounded-full border border-white/40 px-3 py-2 text-white"
                >
                    <Icon name="paste" fill="white" size={16} />
                    <span className="text-label-l">{t('qrScanner.useCopiedCode')}</span>
                </button>
            ) : null}
        </div>
    )
}

// Below this height the stack under the scan square would run into the My QR
// drawer peek, so the paste actions move to a strip pinned above it instead.
const SHORT_VIEWPORT_QUERY = '(max-height: 729px)'

function useShortViewport(): boolean {
    const [isShort, setIsShort] = useState(false)
    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
        const mq = window.matchMedia(SHORT_VIEWPORT_QUERY)
        const update = () => setIsShort(mq.matches)
        update()
        mq.addEventListener?.('change', update)
        return () => mq.removeEventListener?.('change', update)
    }, [])
    return isShort
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
    const isShortViewport = useShortViewport()
    return (
        <>
            <div className="fixed left-1/2 flex h-64 w-64 -translate-x-1/2 translate-y-1/2 justify-center">
                {/* Darkened background with transparent scan region */}
                <div className="absolute inset-0">
                    <div className="absolute inset-0 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.8)]" />
                    {CORNER_POSITIONS.map(({ position, rotation }, index) => (
                        <PinkCorner key={index} className={`absolute ${position} ${rotation}`} />
                    ))}
                </div>

                {/* Supported payment methods, then the paste actions, stacked under
                    the scan square so the paste link reads as part of the scanner
                    rather than as a stray control above the My QR drawer. The
                    square is pinned to the top of the viewport and the drawer peek
                    (QR_DRAWER_PEEK_PX) grows from the bottom, so on a short screen
                    (below 730px) this stack would run under the peek: the badge row
                    hides and the paste actions move to the strip below instead. */}
                <div
                    className="flex-column z-50 translate-y-[100%] transform items-center text-center"
                    data-testid="qr-scan-region"
                >
                    {/* 2x2 grid, not a wrapping row: four badges of unequal width
                        reflowed into a 3+1 that read as a broken row (Kush, 2026-09-02). */}
                    <div className="mt-6 grid grid-cols-2 gap-2 [@media(max-height:729px)]:hidden">
                        {PAYMENT_METHODS.map((method) => (
                            <PaymentMethodBadge
                                key={method.name ?? 'evm'}
                                src={method.src}
                                alt={method.alt ?? t('qrScanner.paymentMethods.evmAlt')}
                                name={method.name ?? t('qrScanner.paymentMethods.evmName')}
                            />
                        ))}
                    </div>
                    {!isShortViewport && (
                        <PasteActions
                            className="mt-6"
                            onPaste={onPaste}
                            detectedAddress={detectedAddress}
                            onUseDetected={onUseDetected}
                            showPasteChip={showPasteChip}
                            onUsePasteChip={onUsePasteChip}
                        />
                    )}
                </div>
            </div>
            {/* Short viewports: the same actions, bottom-constrained just above the
                drawer peek so the z-60 drawer never covers them. Tailwind can't JIT
                the interpolated offset, hence the inline style. */}
            {isShortViewport && (
                <div
                    className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center"
                    style={{ bottom: QR_DRAWER_PEEK_PX + QR_DRAWER_PASTE_GAP_PX }}
                    data-testid="qr-paste-strip"
                >
                    <div className="pointer-events-auto flex flex-col items-center">
                        <PasteActions
                            onPaste={onPaste}
                            detectedAddress={detectedAddress}
                            onUseDetected={onUseDetected}
                            showPasteChip={showPasteChip}
                            onUsePasteChip={onUsePasteChip}
                        />
                    </div>
                </div>
            )}
        </>
    )
}

function ErrorView({
    message,
    onClose,
    onRetry,
    children,
}: {
    message: string
    onClose: () => void
    onRetry?: () => void
    children?: React.ReactNode
}) {
    const tCommon = useTranslations('common')
    return (
        <div className="p-4 text-center text-white">
            <p className="text-foreground-error">{message}</p>
            <div className="mt-4 flex items-center justify-center gap-2">
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="rounded-sm bg-background-default px-4 py-2 text-foreground-primary"
                    >
                        {tCommon('retry')}
                    </button>
                )}
                <button
                    onClick={onClose}
                    className="rounded-sm bg-background-default px-4 py-2 text-foreground-primary"
                >
                    {tCommon('close')}
                </button>
            </div>
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
            // console.info, not error: captureConsoleIntegration would turn an
            // error-level log into a second Sentry event on top of the capture below.
            console.info('Error processing QR code:', err)
            reportQrScanError(err, data)
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
                <ErrorView message={error} onClose={close} onRetry={retryCamera}>
                    <PasteActions
                        className="mt-10"
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

import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { NAV_CIRCLE_BUTTON_CLASSES } from '@/components/Global/NavHeader/navHeader.consts'
import { MERCADO_PAGO, PIX } from '@/assets/payment-apps'
import { LOGO } from '@/assets/brand'
import { ETHEREUM_ICON } from '@/assets/icons'
import { QR_DRAWER_PASTE_GAP_PX, QR_DRAWER_PEEK_PX } from '@/constants/qr-drawer.consts'
import Image from 'next/image'
import { Icon } from '../Icons/Icon'
import Loading from '../Loading'
import { useQRScanner, type QRScanHandler } from './useQRScanner'
import { useBackHandler } from '@/hooks/useBackHandler'
import { useToast } from '@/components/0_Bruddle/Toast'
import CameraPermissionDrawer from './CameraPermissionDrawer'
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
// row is the odd one out: its label is descriptive prose, so it
// carries a key instead and is resolved at render.
const PAYMENT_METHODS = [
    { src: LOGO, name: 'Peanut' },
    { src: MERCADO_PAGO, name: 'Mercado Pago' },
    { src: PIX, name: 'Pix' },
    { src: ETHEREUM_ICON, name: null },
] as const

const CORNER_POSITIONS = [
    { position: '-left-1 -top-1', rotation: '' },
    { position: '-right-1 -top-1', rotation: 'rotate-90' },
    { position: '-bottom-1 -left-1', rotation: '-rotate-90' },
    { position: '-bottom-1 -right-1', rotation: '-rotate-180' },
] as const

// Below 730px, use compact pills and anchored paste actions. Tracked in JS
// (not CSS dual-render): rendering PasteActions twice put duplicate interactive
// controls in the DOM and the a11y tree order could not be trusted.
const SHORT_VIEWPORT_QUERY = '(max-height: 729px)'

function useIsShortViewport(): boolean {
    const [isShort, setIsShort] = useState(false)
    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return
        const mq = window.matchMedia(SHORT_VIEWPORT_QUERY)
        const update = () => setIsShort(mq.matches)
        update()
        mq.addEventListener('change', update)
        return () => mq.removeEventListener('change', update)
    }, [])
    return isShort
}

// ============================================================================
// Types
// ============================================================================

export interface QRScannerProps {
    onScan: QRScanHandler
    onClose?: () => void
    isOpen?: boolean
    /** Reports the camera-permission-denied recovery state, so the host can
     *  clear anything it floats above the scanner (the my-QR peek sits at
     *  z-60 and would cover the z-50 recovery sheet). */
    onPermissionDenied?: (denied: boolean) => void
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

// Konrad's approved 06A treatment: informational network pills on the camera,
// separate from the DS Badge's status colours and from selectable controls.
function PaymentMethodPill({ src, name, compact }: { src: string; name: string; compact: boolean }) {
    return (
        <li
            className={`flex min-w-0 items-center justify-center gap-1 rounded-full border border-foreground-inverse/25 bg-background-default/12 px-2 text-foreground-inverse backdrop-blur ${compact ? 'min-h-6 py-0.5 text-body-xs' : 'min-h-8 py-1 text-body-s'}`}
        >
            <Image
                src={src}
                alt=""
                width={compact ? 16 : 20}
                height={compact ? 16 : 20}
                className={`shrink-0 object-contain ${compact ? 'size-4' : 'size-5'}`}
                priority
            />
            <span className="text-center">{name}</span>
        </li>
    )
}

function ScannerControls({ onClose, onToggleCamera }: { onClose: () => void; onToggleCamera: () => void }) {
    const t = useTranslations('global')
    return (
        // portalled overlay escapes the layout's safe-area padding; max() keeps the old 2.5rem on web
        <div className="fixed top-0 left-0 z-50 grid w-full grid-flow-col items-center pt-[max(2.5rem,calc(var(--safe-top)_+_0.5rem))] pb-2 text-center text-white">
            {/* ds icon-button recipe: the nav circle, inverted for the camera
                feed — white ring and glyph at rest, pink fill on press */}
            <Button
                variant="ghost"
                className={`${NAV_CIRCLE_BUTTON_CLASSES} mx-auto justify-center border-white fill-white text-white`}
                onClick={onClose}
            >
                <Icon name="cancel" size={20} />
            </Button>
            <span className="text-heading-m text-foreground-inverse">{t('qrScanner.scanToPay')}</span>
            <Button
                variant="ghost"
                className={`${NAV_CIRCLE_BUTTON_CLASSES} mx-auto justify-center border-white fill-white text-white`}
                onClick={onToggleCamera}
            >
                <Icon name="camera-flip" size={20} />
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
            {/* stays white: the link sits on the live camera feed, where the
                secondary gray of the stock chrome would not read */}
            <LinkButton onClick={onPaste} className="mx-auto mt-4 flex text-white hover:text-white active:text-white">
                <Icon name="paste" fill="white" height={16} width={16} />
                {t('qrScanner.clickToPaste')}
            </LinkButton>
            {detectedAddress ? (
                <button
                    onClick={onUseDetected}
                    // mt-4: clear of the paste link's 14px extended hit area above
                    className="mx-auto mt-4 flex items-center gap-1 rounded-full border border-white/40 px-3 py-2 text-white"
                >
                    <Icon name="wallet" fill="white" height={16} width={16} />
                    <span className="text-label-l">{printableAddress(detectedAddress)}</span>
                </button>
            ) : showPasteChip ? (
                <button
                    onClick={onUsePasteChip}
                    // mt-4: clear of the paste link's 14px extended hit area above
                    className="mx-auto mt-4 flex items-center gap-1 rounded-full border border-white/40 px-3 py-2 text-white"
                >
                    <Icon name="paste" fill="white" height={16} width={16} />
                    <span className="text-label-l">{t('qrScanner.useCopiedCode')}</span>
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
    const isShortViewport = useIsShortViewport()
    const hasClipboardShortcut = Boolean(detectedAddress) || showPasteChip
    const compactNetworks = isShortViewport || hasClipboardShortcut
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

                {/* The pills stay on the camera. Compact screens retain the
                    existing anchored paste actions below; when their clipboard
                    shortcut needs the space, hide the informational group. */}
                <div
                    className={`pointer-events-auto absolute inset-x-0 top-full z-50 flex flex-col items-center ${isShortViewport ? 'mt-2' : 'mt-6'}`}
                >
                    {!(isShortViewport && hasClipboardShortcut) && (
                        <div className="w-[calc(100vw-3rem)] max-w-80 [@media(max-height:666px)]:hidden">
                            <p
                                className={`text-center text-body-xs text-foreground-inverse ${compactNetworks ? 'mb-1' : 'mb-2'}`}
                            >
                                {t('qrScanner.supportedQrCodes')}
                            </p>
                            <ul
                                aria-label={t('qrScanner.supportedQrCodes')}
                                className={`grid grid-cols-2 gap-x-2 ${compactNetworks ? 'gap-y-1' : 'gap-y-2'}`}
                            >
                                {PAYMENT_METHODS.map((method) => (
                                    <PaymentMethodPill
                                        key={method.name ?? 'evm'}
                                        src={method.src}
                                        name={method.name ?? t('qrScanner.paymentMethods.evmName')}
                                        compact={compactNetworks}
                                    />
                                ))}
                            </ul>
                        </div>
                    )}
                    {!isShortViewport && (
                        <PasteActions
                            onPaste={onPaste}
                            detectedAddress={detectedAddress}
                            onUseDetected={onUseDetected}
                            showPasteChip={showPasteChip}
                            onUsePasteChip={onUsePasteChip}
                        />
                    )}
                </div>
            </div>

            {/* Short-viewport fallback: a viewport-fixed sibling OUTSIDE the
                transformed square, anchored a gap above the drawer peek (the
                pre-#20 geometry) — inside the square's subtree the transform
                would hijack the containing block for position:fixed. Exactly
                one PasteActions copy renders (useIsShortViewport), never two. */}
            {isShortViewport && (
                <div
                    className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center"
                    style={{ bottom: QR_DRAWER_PEEK_PX + QR_DRAWER_PASTE_GAP_PX }}
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

export default function QRScanner({ onScan, onClose, onPermissionDenied, isOpen = true }: QRScannerProps) {
    const { error, isPermissionDenied, isScanning, isCameraReady, videoRef, close, toggleCamera, retryCamera } =
        useQRScanner(onScan, onClose, isOpen)
    // The scanner is an overlay, not a route: unhandled, Android back falls through to minimizeApp on Home.
    useBackHandler(() => {
        close()
        return true
    }, isScanning)
    useEffect(() => {
        onPermissionDenied?.(isPermissionDenied)
        return () => onPermissionDenied?.(false)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- callback identity is the host's concern
    }, [isPermissionDenied])
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
     * Web: no pre-read at all; "Paste code" remains.
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
        } catch {
            reportQrScanError(data)
            toast.error(t('qrScanner.qrProcessingError'))
        }
    }

    /*
     * The iOS chip is a nudge, not a filter: hasStrings() reports only THAT the
     * clipboard has text, never what it is. Extracting an EVM address here and
     * rejecting everything else therefore turned the chip into a dead end for
     * the payloads the scanner exists to accept — a pasted Pix copia-e-cola was
     * refused as "not a wallet address". Hand the raw text to the same scan path
     * as "Paste code" and let recognizeQr decide.
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
                <CameraPermissionDrawer visible onRetry={retryCamera} onClose={close} />
            ) : error ? (
                <ErrorView message={error} onClose={close} onRetry={retryCamera}>
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
                            <Loading className="size-8 text-white" />
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

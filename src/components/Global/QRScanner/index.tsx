import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
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
import { isAddress } from 'viem'
import { readClipboard } from '@/utils/clipboard-extract.utils'
import { isAndroidNative } from '@/utils/capacitor'
import { isPixEmvcoQr } from '@/utils/withdraw.utils'
import { useOverlayVisibility } from '@/utils/overlay-visibility'
import { reportQrScanError } from './utils'

// ============================================================================
// Configuration
// ============================================================================

// Brand names stay verbatim — they are proper nouns in every locale. The EVM
// row is the odd one out: its label is descriptive prose, so it
// carries a key instead and is resolved at render.
const PAYMENT_METHODS = [
    { src: LOGO, name: 'Peanut', onDisc: false },
    { src: MERCADO_PAGO, name: 'Mercado Pago', onDisc: false },
    { src: PIX, name: 'Pix', onDisc: false },
    // the Ethereum mark is dark: without a light disc it is lost on the camera
    { src: ETHEREUM_ICON, name: null, onDisc: true },
] as const

const CORNER_POSITIONS = [
    { position: '-left-1 -top-1', rotation: '' },
    { position: '-right-1 -top-1', rotation: 'rotate-90' },
    { position: '-bottom-1 -left-1', rotation: '-rotate-90' },
    { position: '-bottom-1 -right-1', rotation: '-rotate-180' },
] as const

// Tracked in JS (not CSS dual-render): rendering the paste button twice put
// duplicate interactive controls in the DOM and the a11y tree order could not
// be trusted.
// Under 730px the pills compact so pills and button clear the drawer peek.
const SHORT_VIEWPORT_QUERY = '(max-height: 729px)'
// Under 667px both no longer fit between the scan square and the drawer peek:
// the pills go and the button anchors to the drawer.
const TINY_VIEWPORT_QUERY = '(max-height: 666px)'

function useMatchesMedia(query: string): boolean {
    const [matches, setMatches] = useState(false)
    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return
        const mq = window.matchMedia(query)
        const update = () => setMatches(mq.matches)
        update()
        mq.addEventListener('change', update)
        return () => mq.removeEventListener('change', update)
    }, [query])
    return matches
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
    /** Leaves Pix out of the accepted-method badges, for a user Pix is paused for. */
    hidePix?: boolean
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
function PaymentMethodPill({
    src,
    name,
    compact,
    onDisc,
    className,
}: {
    src: string
    name: string
    compact: boolean
    onDisc: boolean
    className?: string
}) {
    return (
        <li
            className={`flex min-w-0 items-center justify-center gap-1 rounded-full border border-foreground-inverse/25 bg-background-default/12 px-2 text-foreground-inverse backdrop-blur ${compact ? 'min-h-6 py-0.5 text-body-xs' : 'min-h-8 py-1 text-body-s'} ${className ?? ''}`}
        >
            <Image
                src={src}
                alt=""
                width={compact ? 16 : 20}
                height={compact ? 16 : 20}
                className={`shrink-0 object-contain ${compact ? 'size-4' : 'size-5'} ${onDisc ? 'rounded-full bg-background-default' : ''}`}
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

// One paste control, always present and never disabled: the app cannot know
// what the clipboard holds before a tap (iOS reports at most "has text", web
// nothing), so the tap reads it fresh and recognizeQr decides. Primary, not
// secondary: on the dark camera ground the secondary's black shadow is lost.
// The label names the copied thing only where the app already knows it
// (Android, see the read at open); the tap still reads the clipboard fresh.
type CopiedKind = 'pix' | 'address' | null

const PASTE_LABEL_KEYS = {
    pix: 'qrScanner.pastePixCode',
    address: 'qrScanner.pasteAddress',
} as const

function PasteButton({
    onPaste,
    copiedKind,
    className,
}: {
    onPaste: () => void
    copiedKind: CopiedKind
    className?: string
}) {
    const t = useTranslations('global')
    return (
        <Button variant="primary" size="small" icon="paste" onClick={onPaste} className={`w-fit ${className ?? ''}`}>
            {t(copiedKind ? PASTE_LABEL_KEYS[copiedKind] : 'qrScanner.paste')}
        </Button>
    )
}

function ScanRegionOverlay({
    onPaste,
    copiedKind,
    hidePix,
}: {
    onPaste: () => void
    copiedKind: CopiedKind
    hidePix?: boolean
}) {
    const t = useTranslations('global')
    const isShortViewport = useMatchesMedia(SHORT_VIEWPORT_QUERY)
    const isTinyViewport = useMatchesMedia(TINY_VIEWPORT_QUERY)
    const methods = PAYMENT_METHODS.filter((method) => !hidePix || method.name !== 'Pix')
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

                {/* Network pills (2-per-row grid) then the paste button, hanging
                    below the scan square so the group reads as part of it. The
                    tiny fallback below cannot live in this subtree, because the
                    square's transform makes it the containing block for
                    position:fixed — a bottom offset here would resolve against
                    the 256px square, not the viewport. */}
                {!isTinyViewport && (
                    <div
                        className={`pointer-events-auto absolute top-full left-1/2 z-50 flex w-[calc(100vw-3rem)] max-w-80 -translate-x-1/2 flex-col items-center ${isShortViewport ? 'mt-2' : 'mt-6'}`}
                    >
                        <ul
                            // explicit role: Safari drops list semantics once list-style is none
                            role="list"
                            aria-label={t('qrScanner.supportedQrCodes')}
                            className={`grid w-full grid-cols-2 gap-x-2 ${isShortViewport ? 'gap-y-1' : 'gap-y-2'}`}
                        >
                            {/* an odd count (Pix left out) centres its last pill on its own row; four keep the 2×2 */}
                            {methods.map((method, index) => (
                                <PaymentMethodPill
                                    key={method.name ?? 'evm'}
                                    src={method.src}
                                    name={method.name ?? t('qrScanner.paymentMethods.evmName')}
                                    compact={isShortViewport}
                                    onDisc={method.onDisc}
                                    className={
                                        methods.length % 2 === 1 && index === methods.length - 1
                                            ? 'col-span-2 w-[calc(50%-0.25rem)] justify-self-center'
                                            : undefined
                                    }
                                />
                            ))}
                        </ul>
                        <PasteButton
                            onPaste={onPaste}
                            copiedKind={copiedKind}
                            className={isShortViewport ? 'mt-3' : 'mt-4'}
                        />
                    </div>
                )}
            </div>

            {/* Tiny-viewport fallback: a viewport-fixed sibling OUTSIDE the
                transformed square, anchored a gap above the drawer peek —
                inside the square's subtree the transform would hijack the
                containing block for position:fixed. Exactly one PasteButton
                renders, never two. */}
            {isTinyViewport && (
                <div
                    className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center"
                    style={{ bottom: QR_DRAWER_PEEK_PX + QR_DRAWER_PASTE_GAP_PX }}
                >
                    <PasteButton onPaste={onPaste} copiedKind={copiedKind} className="pointer-events-auto" />
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

export default function QRScanner({ onScan, onClose, onPermissionDenied, isOpen = true, hidePix }: QRScannerProps) {
    const { error, isPermissionDenied, isScanning, isCameraReady, videoRef, close, toggleCamera, retryCamera } =
        useQRScanner(onScan, onClose, isOpen)
    useOverlayVisibility(isScanning)
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
    const [copiedKind, setCopiedKind] = useState<CopiedKind>(null)
    const isPasting = useRef(false)

    /*
     * Android native only: read at open to name what was copied on the paste
     * button — the read only trips the system paste toast, nothing blocking.
     * iOS native: an un-gestured Clipboard.read() raises the "Allow Paste"
     * alert, which raced the camera permission dialog and blocked it
     * (PEANUT-UI-PYW). Web: a read needs a gesture. Both keep the plain label.
     * The value read here only picks the label; it is never paid.
     */
    useEffect(() => {
        if (!isScanning || !isAndroidNative()) {
            setCopiedKind(null)
            return
        }
        let cancelled = false
        const readCopiedKind = () => {
            Clipboard.read()
                .then(({ value }) => {
                    if (cancelled) return
                    const text = (value ?? '').trim()
                    setCopiedKind(isPixEmvcoQr(text) ? 'pix' : isAddress(text) ? 'address' : null)
                })
                .catch(() => {
                    if (!cancelled) setCopiedKind(null)
                })
        }
        readCopiedKind()
        // the user may leave to copy something else while the scanner stays open
        const onVisible = () => {
            if (document.visibilityState === 'visible') readCopiedKind()
        }
        document.addEventListener('visibilitychange', onVisible)
        // Android WebViews do not reliably fire visibilitychange, so the native
        // lifecycle is the authority; the DOM event stays as a fallback.
        let removeNative: (() => void) | undefined
        import('@capacitor/app')
            .then(({ App }) =>
                App.addListener('appStateChange', ({ isActive }) => {
                    if (isActive) readCopiedKind()
                })
            )
            .then((handle) => {
                if (cancelled) handle.remove()
                else removeNative = () => handle.remove()
            })
            .catch(() => {
                // no bridge (old native shell): the DOM event covers it
            })
        return () => {
            cancelled = true
            removeNative?.()
            document.removeEventListener('visibilitychange', onVisible)
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

    // No filter by type: recognizeQr accepts far more than the label can
    // name, so the raw text goes down the same path as a camera scan. The
    // in-flight ref stops a double tap from opening the payment twice.
    const handlePaste = async () => {
        if (isPasting.current) return
        isPasting.current = true
        try {
            const text = await readClipboardText()
            if (text) await scanValue(text)
        } finally {
            isPasting.current = false
        }
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
                    <PasteButton onPaste={handlePaste} copiedKind={copiedKind} className="mx-auto mt-4" />
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
                    <ScanRegionOverlay onPaste={handlePaste} copiedKind={copiedKind} hidePix={hidePix} />
                </>
            )}
        </div>,
        document.body
    )
}

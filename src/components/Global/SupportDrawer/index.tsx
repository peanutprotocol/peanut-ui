'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useModalsContext } from '@/context/ModalsContext'
import { useCrispUserData } from '@/hooks/useCrispUserData'
import { useCrispTokenId } from '@/hooks/useCrispTokenId'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import PeanutLoading from '../PeanutLoading'
import { Button } from '@/components/0_Bruddle/Button'
import {
    SUPPORT_EMAIL,
    CRISP_LOCALE_BY_APP_LOCALE,
    CRISP_PROXY_REQUEST_INIT_MSG,
    CRISP_PROXY_INIT_MSG,
    type CrispInitPayload,
} from '@/constants/crisp'
import type { AppLocale } from '@/i18n/app/config'
import { notificationsApi } from '@/services/notifications'
import { isCapacitor } from '@/utils/capacitor'
import { ensureNativeCameraPermission } from '@/utils/camera-permission'
import { ensureNativeCrispConfigured, nativeCrispFields } from '@/utils/crisp'

const DISMISS_THRESHOLD = 100

/** Backdrop left showing above the panel when the keyboard squeezes it. */
const TOP_RESERVE = 24

const SupportDrawer = () => {
    const t = useTranslations('global')
    const tCommon = useTranslations('common')
    const { isSupportModalOpen, setIsSupportModalOpen, supportPrefilledMessage: prefilledMessage } = useModalsContext()
    const userData = useCrispUserData()
    const crispTokenId = useCrispTokenId()
    const [isCrispReady, setIsCrispReady] = useState(false)
    // The proxy reports CRISP_FAILED when the Crisp bundle never loads (blank-panel bug).
    const [isCrispFailed, setIsCrispFailed] = useState(false)
    // Bumping this key remounts the iframe, giving the user a clean retry.
    const [iframeKey, setIframeKey] = useState(0)

    const locale = useLocale() as AppLocale
    const crispLocale = CRISP_LOCALE_BY_APP_LOCALE[locale] ?? 'en'

    /*
     * The latest committed payload, read by both Crisp sinks.
     *
     * The proxy iframe pulls it via the postMessage handshake — user data and the
     * Crisp token never appear in its URL (postmortem F5: a query string leaks into
     * Vercel logs, browser history, Referer headers, and analytics $current_url).
     * A ref keeps the reply current without re-registering the message listener.
     *
     * The native open chain reads it AFTER its awaits, because the snapshot is
     * live: a balance can land, or verification can resolve, while Crisp
     * configuration and the camera permission are still pending. The effect
     * closure holds the payload from when the effect ran, so publishing that
     * would push a balance the user no longer has — and a `balance-unavailable`
     * segment that would route them wrongly — to the agent.
     *
     * Written in an effect, not during render, so a discarded render can't leak
     * an uncommitted identity to either sink.
     */
    const latestPayload: CrispInitPayload = {
        locale: crispLocale,
        tokenId: crispTokenId,
        userData,
        prefilledMessage,
    }
    const latestPayloadRef = useRef<CrispInitPayload>(latestPayload)
    useEffect(() => {
        latestPayloadRef.current = latestPayload
    })

    // The handshake pull happens once at iframe boot; later changes (email/name
    // resolving mid-session, a new prefill) are pushed over the same channel so
    // Crisp never keeps a stale identity. Token/locale changes remount the iframe
    // via its key instead — those need a session re-bind, not a data update.
    const iframeRef = useRef<HTMLIFrameElement | null>(null)
    useEffect(() => {
        iframeRef.current?.contentWindow?.postMessage(
            { type: CRISP_PROXY_INIT_MSG, payload: latestPayloadRef.current },
            window.location.origin
        )
    }, [userData, prefilledMessage])

    // Crisp's composer sits at the very bottom of the iframe, so the panel's bottom
    // edge is the thing the iOS keyboard covers. Only measured while the drawer is
    // open — see the hook for why CSS alone can't see the keyboard.
    const { height: visibleHeight, keyboardInset } = useVisualViewport(isSupportModalOpen)

    /*
     * The proxy iframe boots the ENTIRE Next.js app at /crisp-proxy, and its key
     * recomputes when the token or locale changes — each change reloads it.
     * Mounted eagerly, that meant a hidden full app instance rebooting over and
     * over behind every screen; on low-memory iPhones the accumulated pressure
     * crashed the WKWebView content process mid-signup, hard-resetting the app
     * to the start of setup. Mount it only after the drawer has actually been
     * opened — and never on Capacitor, where support opens the native Crisp
     * messenger instead.
     */
    const [hasBeenOpened, setHasBeenOpened] = useState(false)
    useEffect(() => {
        if (isSupportModalOpen) setHasBeenOpened(true)
    }, [isSupportModalOpen])

    // Guests reach this drawer too (claim and pay links mount the same layout),
    // and they have no notifications — the call would just 401.
    const isLoggedIn = Boolean(userData.userId)

    const clearSupportBadge = useCallback(() => {
        if (!isLoggedIn) return
        notificationsApi
            .markAllRead('support')
            .then(() => window.dispatchEvent(new CustomEvent('notifications:updated')))
            // A failed mark-read only means the badge stays on a bit longer.
            .catch(() => {})
    }, [isLoggedIn])

    /*
     * Clear the support unread badge — on the web path only; the Capacitor
     * effect below clears its own once the native messenger actually opens.
     *
     * "Opened the drawer" is not the same as "read the reply". When the Crisp
     * bundle fails to load, this same component shows the email fallback
     * instead, and clearing then would bury a reply nobody saw. So wait until
     * the chat is really in front of the user.
     *
     * The closing edge matters just as much: a reply arriving while the drawer
     * is open — the normal case in a live conversation — would otherwise light
     * the badge with nothing new behind it, and leave it lit until the user
     * opened support again.
     */
    const wasShowingChat = useRef(false)
    useEffect(() => {
        const isShowingChat = isSupportModalOpen && isCrispReady && !isCrispFailed
        if (isShowingChat) {
            wasShowingChat.current = true
            clearSupportBadge()
        } else if (wasShowingChat.current && !isSupportModalOpen) {
            wasShowingChat.current = false
            clearSupportBadge()
        }
    }, [isSupportModalOpen, isCrispReady, isCrispFailed, clearSupportBadge])

    const handleRetry = useCallback(() => {
        setIsCrispFailed(false)
        setIsCrispReady(false)
        setIframeKey((k) => k + 1)
    }, [])

    // a token/locale change replaces the iframe (see the key below) — clear the
    // previous proxy's status so the loader shows until the new one reports
    useEffect(() => {
        setIsCrispReady(false)
        setIsCrispFailed(false)
    }, [crispTokenId, crispLocale])

    // A logged-in user's token is computed asynchronously (SHA-256 of their userId).
    // Until it resolves we must NOT load the proxy: a token-less load makes Crisp fall
    // back to the shared anonymous session persisted on client.crisp.chat, which on a
    // browser that has hosted more than one Peanut account surfaces the *previous*
    // user's conversation. Anonymous visitors (no userId) have no token by design and
    // load immediately.
    const isAwaitingToken = Boolean(userData.userId) && !crispTokenId

    // in capacitor, open native crisp messenger instead of iframe.
    // Same token gate as the web iframe: for a logged-in user we must not
    // openMessenger() before the token resolves — a token-less native open
    // falls back to the device-local Crisp session, which on a shared device
    // surfaces the previous user's conversation. The effect re-runs and opens
    // once crispTokenId resolves (it's in the deps).
    /*
     * Opening native Crisp is a one-shot action, so this effect depends only on
     * what defines an open cycle: the drawer being open, and the token being
     * ready.
     *
     * It used to depend on `userData`, `crispTokenId` and `prefilledMessage`
     * too — the data it publishes. That is what made it hard: the snapshot is
     * live, so a balance landing mid-chain re-ran an effect whose tail sends a
     * message and opens a window, and each guard against that produced the next
     * defect (a duplicate prefill, then a stale payload, then a duplicate again
     * across close/reopen). The data is read from `latestPayloadRef` when the
     * chain actually publishes, so it does not belong in the deps at all.
     *
     * With the deps trimmed, one open cycle runs the chain exactly once and
     * React's own cleanup handles the rest: closing or reopening tears down the
     * previous run, and `cancelled` stops a chain from a cycle the user has
     * left from opening a messenger they walked away from.
     */
    useEffect(() => {
        if (!isSupportModalOpen || !isCapacitor() || isAwaitingToken) return
        let cancelled = false

        ensureNativeCrispConfigured()
            .then(async ({ CapacitorCrisp }) => {
                /*
                 * Settle the CAMERA runtime permission before the native Crisp UI
                 * opens: the app manifest declares CAMERA (QR scanner), which makes
                 * Crisp's "Take a photo" throw a SecurityException when it is
                 * declared-but-ungranted — the SDK never requests it itself.
                 * Result deliberately ignored: a denied camera must not block chat.
                 */
                await ensureNativeCameraPermission()

                // The user dismissed support while we awaited. Publishing now
                // would push the prefill into a conversation they walked away from.
                if (cancelled) return

                /*
                 * Read the payload here, not from the effect closure. The chain
                 * runs once per open cycle, so a snapshot that lands during
                 * setup gets no second chance to publish — the closure's copy
                 * would freeze whatever was true when support was tapped, and an
                 * agent would read a balance the user no longer has.
                 */
                const { userData: snapshot, tokenId, prefilledMessage: prefill } = latestPayloadRef.current
                // Optional only on the proxy wire shape — this ref is always
                // seeded with the current snapshot, so this never returns.
                if (!snapshot) return

                // set user data before opening
                if (snapshot.email || snapshot.fullName) {
                    CapacitorCrisp.setUser({
                        email: snapshot.email || undefined,
                        nickname: snapshot.fullName || snapshot.username || undefined,
                        avatar: snapshot.avatar || undefined,
                    })
                }
                if (tokenId) {
                    CapacitorCrisp.setTokenID({ tokenID: tokenId })
                }
                /*
                 * Custom data for support agents. Every key is written
                 * unconditionally (empty string when absent) so a previous
                 * user's values can't linger on the device-local Crisp session,
                 * and so this list stays a mirror of the web/proxy sink — it had
                 * drifted to two keys while web sent seven, which left native
                 * agents (i.e. agents helping app users) with less than the
                 * agents helping web users.
                 */
                for (const [key, value] of nativeCrispFields(snapshot, prefill)) {
                    CapacitorCrisp.setString({ key, value })
                }
                /*
                 * No native segment. The plugin exposes only the one-argument
                 * `setSegment`, which on Android calls `Crisp.setSessionSegment`
                 * with no overwrite flag — so a segment APPENDS and a stale one
                 * (`offline`, `balance-unavailable`, `kyc-pending`) keeps routing
                 * the conversation after the user has left that state. A routing
                 * tag that is wrong is worse than one that is missing.
                 *
                 * Nothing is lost to the agent: the `segments` data row above
                 * carries the whole list, and `setString` assigns, so it replaces
                 * cleanly on every open. Restore this when the plugin exposes the
                 * SDK's overwrite overload.
                 */
                /*
                 * No sendMessage on native. The plugin declares it
                 * `unimplemented` on BOTH iOS and Android, so this never
                 * prefilled anything in the app — it only left an unhandled
                 * rejection ("Not implemented on ios") behind every support open
                 * that carried a topic. The topic rides in the `support_topic`
                 * data row above instead, which both platforms implement.
                 *
                 * The user's composer stays empty on native, so they still write
                 * their own opening message — but the agent is no longer blind to
                 * what brought them there.
                 */
                CapacitorCrisp.openMessenger()
                // The chat is now in front of the user, so the badge has done its
                // job. There is no isCrispReady on this path — the native messenger
                // reports nothing back — so clear it here rather than in the web
                // effect above.
                clearSupportBadge()
                // close our drawer since native UI takes over
                setIsSupportModalOpen(false)
            })
            .catch((err: unknown) => {
                // ensureNativeCrispConfigured clears its own memo on failure, so
                // reopening support genuinely re-configures rather than replaying
                // a rejected promise.
                console.warn('[SupportDrawer] native crisp open failed:', err)
            })

        return () => {
            cancelled = true
        }
    }, [isSupportModalOpen, isAwaitingToken, setIsSupportModalOpen, clearSupportBadge])

    // drag-to-dismiss state
    const panelRef = useRef<HTMLDivElement>(null)
    const dragStartY = useRef<number | null>(null)
    const [dragOffset, setDragOffset] = useState(0)
    const isDragging = dragStartY.current !== null

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        dragStartY.current = e.touches[0].clientY
    }, [])

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (dragStartY.current === null) return
        const delta = e.touches[0].clientY - dragStartY.current
        // only allow dragging downward
        setDragOffset(Math.max(0, delta))
    }, [])

    const handleTouchEnd = useCallback(() => {
        if (dragOffset > DISMISS_THRESHOLD) {
            setIsSupportModalOpen(false)
        }
        dragStartY.current = null
        setDragOffset(0)
    }, [dragOffset, setIsSupportModalOpen])

    // listen for crisp messages once — persists across open/close cycles.
    // Registered at drawer mount, long before the iframe can mount (hasBeenOpened
    // gate), so the proxy's init request can never race past this listener.
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return

            if (
                event.data?.type === CRISP_PROXY_REQUEST_INIT_MSG &&
                event.source === iframeRef.current?.contentWindow
            ) {
                // the proxy iframe asks for its init payload — reply only to OUR
                // mounted iframe (not any same-origin frame), and directly to it,
                // never broadcast
                ;(event.source as Window | null)?.postMessage(
                    { type: CRISP_PROXY_INIT_MSG, payload: latestPayloadRef.current },
                    window.location.origin
                )
            } else if (event.data?.type === 'CRISP_READY') {
                setIsCrispReady(true)
                setIsCrispFailed(false)
            } else if (event.data?.type === 'CRISP_FAILED') {
                setIsCrispFailed(true)
            }
        }

        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [])

    // close on escape
    useEffect(() => {
        if (!isSupportModalOpen) return
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsSupportModalOpen(false)
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [isSupportModalOpen, setIsSupportModalOpen])

    return (
        <>
            {/* backdrop */}
            {/* pointer-events-auto is load-bearing on BOTH divs: when this drawer is
                opened from inside a vaul drawer (transaction receipt), vaul sets
                pointer-events:none on <body> and these divs inherit it — the whole
                support overlay becomes click-transparent, and taps fall through to
                the receipt underneath (a fall-through tap on "Cancel deposit"
                cancelled a user's funded bank deposit). */}
            <div
                className={`fixed inset-0 z-[999998] bg-black/80 transition-opacity duration-300 ${
                    isSupportModalOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
                }`}
                onClick={() => setIsSupportModalOpen(false)}
                aria-hidden="true"
            />

            {/* slide-up panel — always mounted to preserve drag state; the iframe inside
                mounts only once the token resolves for logged-in users (isAwaitingToken gate) */}
            <div
                ref={panelRef}
                role="dialog"
                aria-label={t('supportDrawer.label')}
                aria-modal={isSupportModalOpen}
                className={`fixed inset-x-0 z-[999999] flex flex-col rounded-t-[10px] border bg-background pt-4 ${
                    isSupportModalOpen ? 'pointer-events-auto translate-y-0' : 'pointer-events-none translate-y-full'
                }`}
                style={{
                    // Sit on top of the keyboard rather than behind it: `bottom: 0` is the
                    // bottom of the *layout* viewport, which iOS leaves under the keyboard.
                    bottom: keyboardInset,
                    // …and never be taller than what's actually on screen, so lifting the
                    // panel pushes the conversation down instead of off the top edge. The
                    // reserved strip keeps the drag handle out from under the notch and
                    // leaves a backdrop target to tap-to-close; with no keyboard up it is
                    // slack and 85dvh wins, so the resting look is unchanged.
                    height: visibleHeight
                        ? `min(85dvh, calc(${visibleHeight}px - env(safe-area-inset-top) - ${TOP_RESERVE}px))`
                        : '85dvh',
                    // The keyboard already covers the home indicator; padding for it too
                    // would just wedge a dead strip between the composer and the keys.
                    paddingBottom: keyboardInset ? 0 : 'env(safe-area-inset-bottom)',
                    transform: isSupportModalOpen ? `translateY(${dragOffset}px)` : 'translateY(100%)',
                    transition: isDragging ? 'none' : 'transform 300ms ease-out',
                }}
            >
                {/* drag handle */}
                <div
                    className="flex cursor-grab items-center justify-center pb-4 active:cursor-grabbing"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="h-1.5 w-10 rounded-full bg-black" />
                </div>

                {/* min-h-0 lets the iframe row shrink below its content when the panel does */}
                <div className="flex min-h-0 w-full flex-1 justify-center">
                    <div className="relative h-full w-full overflow-hidden md:max-w-xl">
                        {(!isCrispReady || isAwaitingToken) && !isCrispFailed && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
                                <PeanutLoading />
                            </div>
                        )}
                        {isCrispFailed && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background px-8 text-center">
                                <p className="text-base font-bold text-n-1">{t('supportDrawer.chatLoadFailed')}</p>
                                <p className="text-sm text-grey-1">{t('supportDrawer.chatLoadFailedDescription')}</p>
                                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-black underline">
                                    {SUPPORT_EMAIL}
                                </a>
                                <Button variant="stroke" className="w-full" onClick={handleRetry}>
                                    {tCommon('tryAgain')}
                                </Button>
                            </div>
                        )}
                        {!isCapacitor() && hasBeenOpened && !isAwaitingToken && (
                            <iframe
                                // token/locale changes need a full session re-bind, so they
                                // remount the proxy; everything else updates live over the
                                // postMessage channel (see the push effect above)
                                key={`${iframeKey}:${crispTokenId ?? ''}:${crispLocale}`}
                                ref={iframeRef}
                                src="/crisp-proxy"
                                className="h-full w-full"
                                allow="storage-access *"
                                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-storage-access-by-user-activation"
                                title={t('supportDrawer.chatTitle')}
                                tabIndex={isSupportModalOpen ? 0 : -1}
                            />
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}

export default SupportDrawer

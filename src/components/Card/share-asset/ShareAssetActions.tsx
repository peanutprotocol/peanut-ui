'use client'

/**
 * <ShareAssetActions /> — Share + Save image buttons for the rendered
 * share asset.
 *
 * Share button strategy:
 *   - If `navigator.share` supports files on this device (iOS Safari +
 *     Chrome Android), capture the asset to PNG and pass it to the OS
 *     share sheet — user picks X / IG / iMessage / etc. The PNG is
 *     attached as a real image, not a link preview.
 *   - Otherwise (desktop browsers): fall back to the legacy
 *     `https://twitter.com/intent/tweet?text=...` URL (text-only).
 *
 * Save button: captures the asset to PNG and triggers a download. Works
 * on every browser; useful even on mobile if the user wants the image
 * before composing the post. In the native app WKWebView silently cancels
 * `<a download>`, so Save goes through the OS share sheet (which carries
 * "Save Image") and is hidden when files can't be shared.
 *
 * Gesture-window constraint (TASK-22407, Sentry PEANUT-UI-SSW): on iOS,
 * `navigator.share()` must run inside the user gesture. Capturing on tap
 * (html-to-image, 1–3s) expired WebKit's gesture window → NotAllowedError.
 * So on devices that can share files we PRE-capture the PNG once the asset
 * is ready and the tap handler shares the cached blob synchronously. A
 * failed pre-capture retries in the background (buttons stay disabled);
 * only after all attempts fail does capture-on-tap return as the fallback.
 */

import { type FC, type RefObject, useEffect, useRef, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { captureShareAsset, canShareImageFiles, downloadBlob, ShareAssetCaptureError } from './captureShareAsset'
import { shareCardOnTwitter } from './share.utils'
import { pickWinCaption } from './winCaptions'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { isNativeBridge } from '@/utils/capacitor'

type SaveMode = 'download' | 'native-share' | 'hidden'

function resolveSaveMode(): SaveMode {
    if (!isNativeBridge()) return 'download'
    return canShareImageFiles() ? 'native-share' : 'hidden'
}

/**
 * Serialise whatever the share/save path threw into something Sentry +
 * PostHog can act on. html-to-image rejects with the raw DOM ErrorEvent
 * from `<img>.onerror` — that has no `.message` and stringifies to
 * `[object Event]`, which is why PEANUT-UI-QHB / QHC gave us no signal.
 */
function describeShareError(err: unknown): {
    name: string
    message: string
    failedImages?: string[]
    eventType?: string
    failedSrc?: string
} {
    if (err instanceof ShareAssetCaptureError) {
        return { name: err.name, message: err.message, failedImages: err.failedImages }
    }
    if (err instanceof Error) {
        return { name: err.name, message: err.message }
    }
    // DOM Event / ErrorEvent path (defence-in-depth — captureShareAsset
    // already wraps this, but a future caller that bypasses it shouldn't
    // regress observability).
    if (err && typeof err === 'object' && 'type' in err) {
        const evt = err as Event
        const failedSrc = (evt.target as HTMLImageElement | null)?.src
        return {
            name: evt.constructor?.name ?? 'Event',
            message: `share-asset rejected with ${evt.type}${failedSrc ? ` on ${failedSrc}` : ''}`,
            eventType: evt.type,
            failedSrc,
        }
    }
    return { name: 'unknown', message: String(err) }
}

interface Props {
    /** Ref to the native-size inner element of <ScaledShareAsset />. */
    captureRef: RefObject<HTMLDivElement | null>
    /** PostHog event source tag ("celebration" | "history-replay"). */
    source: string
    /** Optional filename for the downloaded PNG. */
    filename?: string
    /** Whether the share asset has finished painting its card face (the hand
     *  <img> has loaded — see PixelatedCardFace.onReady). Until then,
     *  capturing would snapshot a blank card, so both buttons stay disabled.
     *  Defaults to true so callers that don't wire the signal aren't blocked. */
    ready?: boolean
    /** The sharer's own profile URL, appended to the share caption. Omit to ship
     *  the caption link-free — see profileShareUrl. */
    shareUrl?: string
    /** The hide-username toggle. Flipping it re-renders the asset (username
     *  shown / hidden), so it keys the pre-capture cache — shareUrl can't,
     *  because it is undefined in both states for users without a handle. */
    hideUsername?: boolean
}

export const ShareAssetActions: FC<Props> = ({
    captureRef,
    source,
    filename = 'peanut-card.png',
    ready = true,
    shareUrl,
    hideUsername = false,
}) => {
    const t = useTranslations('card.share')
    const [isSharing, setIsSharing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saveMode] = useState(resolveSaveMode)

    // One random win caption per mount (rotation lives in winCaptions.ts), so
    // shared timelines don't fill with one identical line. Stable for this
    // mount so Share + the desktop intent post the same caption.
    const [caption] = useState(pickWinCaption)
    // DERIVED, not state: the hide-username toggle flips `shareUrl` after mount,
    // and a state snapshot would post the handle the user just opted out of.
    const text = shareUrl ? `${caption}\n\n${shareUrl}` : caption

    // pre-captured png so the tap handler can call navigator.share() without
    // awaiting the 1-3s capture (which expires ios's gesture window — see the
    // file header). only on devices that can share files: desktop share falls
    // back to the twitter intent and web save downloads, neither needs a
    // gesture, so capturing there would be wasted work. keyed on hideUsername
    // because the toggle re-renders the asset (username shown / hidden), which
    // makes a cached capture stale — shareUrl can't key it, it is undefined in
    // both toggle states for users without a handle.
    const cachedBlobRef = useRef<Blob | null>(null)
    // while true, the gesture-gated buttons stay disabled: a tap mid-capture
    // finds no cached blob, takes the slow capture-on-tap path, and reproduces
    // the exact NotAllowedError this cache exists to fix. only ever true on
    // the canShareImageFiles() path, so desktop is never gated.
    const [isPrecapturing, setIsPrecapturing] = useState(false)
    useEffect(() => {
        cachedBlobRef.current = null
        if (!ready || !canShareImageFiles()) return
        const node = captureRef.current
        if (!node) return
        let stale = false
        let retryTimer: ReturnType<typeof setTimeout> | undefined
        setIsPrecapturing(true)
        const attempt = (retriesLeft: number): void => {
            captureShareAsset(node)
                .then((blob) => {
                    if (stale) return
                    cachedBlobRef.current = blob
                    setIsPrecapturing(false)
                })
                .catch(() => {
                    if (stale) return
                    if (retriesLeft > 0) {
                        // transient failures (an image mid-decode, a font race)
                        // often clear on retry — keep the buttons gated so a tap
                        // can't fall into the slow capture-on-tap path and hit
                        // the gesture-window error this cache exists to fix.
                        retryTimer = setTimeout(() => attempt(retriesLeft - 1), 500)
                        return
                    }
                    // three failed captures: a tap-time capture would fail the
                    // same way, so the gesture window no longer matters. quiet
                    // here — re-enable and let the tap-time fallback surface
                    // the existing error message instead of leaving the
                    // buttons dead forever.
                    setIsPrecapturing(false)
                })
        }
        attempt(2)
        return () => {
            stale = true
            if (retryTimer) clearTimeout(retryTimer)
        }
    }, [ready, hideUsername, captureRef])

    const captureOrCached = async (): Promise<Blob> => {
        if (cachedBlobRef.current) return cachedBlobRef.current
        const node = captureRef.current
        if (!node) throw new Error('share asset not yet rendered — try again in a moment')
        return captureShareAsset(node)
    }

    const handleShare = async (): Promise<void> => {
        setError(null)
        setIsSharing(true)
        try {
            // CHECK SUPPORT FIRST — capturing the PNG is expensive
            // (html-to-image, 2× retina); on desktop we'd waste it. Probe
            // the Web Share API with a 1-byte dummy file BEFORE capture.
            // If unsupported (every desktop browser today), jump to the
            // twitter intent immediately. Also guarantees the fallback
            // still fires if capture itself fails later.
            if (!canShareImageFiles()) {
                posthog.capture(ANALYTICS_EVENTS.CARD_SHARE_ASSET_SHARED, {
                    source,
                    method: 'twitter-intent-fallback',
                    link_type: shareUrl ? 'profile' : 'none',
                })
                shareCardOnTwitter(text)
                return
            }
            // cached blob = zero await before navigator.share(), keeping the
            // call inside the tap gesture on ios.
            const blob = await captureOrCached()
            const file = new File([blob], filename, { type: 'image/png' })
            // The link rides inside `text` — several native targets drop a
            // separate `url` member when `files` is present.
            await navigator.share({ text, files: [file] })
            posthog.capture(ANALYTICS_EVENTS.CARD_SHARE_ASSET_SHARED, {
                source,
                method: 'native-share-with-file',
                link_type: shareUrl ? 'profile' : 'none',
            })
        } catch (err) {
            // AbortError = user cancelled the share sheet. Quiet path.
            if (err instanceof Error && err.name === 'AbortError') return
            const detail = describeShareError(err)
            console.error('[share-asset] share failed', detail)
            Sentry.captureException(err, {
                tags: { feature: 'share-asset', action: 'share', source },
                extra: detail,
            })
            setError(detail.message || t('shareFailed'))
            posthog.capture(ANALYTICS_EVENTS.CARD_SHARE_ASSET_FAILED, {
                source,
                action: 'share',
                ...detail,
            })
        } finally {
            setIsSharing(false)
        }
    }

    const handleSave = async (): Promise<void> => {
        setError(null)
        setIsSaving(true)
        try {
            // native save shares through the os sheet, so it has the same ios
            // gesture-window constraint as share — use the cached blob too.
            const blob = await captureOrCached()
            if (saveMode === 'native-share') {
                await navigator.share({ files: [new File([blob], filename, { type: 'image/png' })] })
            } else {
                downloadBlob(blob, filename)
            }
            posthog.capture(ANALYTICS_EVENTS.CARD_SHARE_ASSET_SAVED, { source, method: saveMode })
        } catch (err) {
            // AbortError = user dismissed the share sheet: neither saved nor failed.
            if (err instanceof Error && err.name === 'AbortError') return
            const detail = describeShareError(err)
            console.error('[share-asset] save failed', detail)
            Sentry.captureException(err, {
                tags: { feature: 'share-asset', action: 'save', source },
                extra: detail,
            })
            setError(detail.message || t('saveFailed'))
            posthog.capture(ANALYTICS_EVENTS.CARD_SHARE_ASSET_FAILED, {
                source,
                action: 'save',
                ...detail,
            })
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <>
            <Button
                onClick={handleShare}
                variant="purple"
                shadowSize="4"
                className="w-full"
                loading={isSharing}
                disabled={isSharing || isSaving || !ready || isPrecapturing}
                icon={<Icon name="share" size={20} />}
            >
                {t('share')}
            </Button>
            {saveMode !== 'hidden' && (
                <Button
                    onClick={handleSave}
                    variant="stroke"
                    className="w-full"
                    loading={isSaving}
                    // web save is a download — no gesture, no pre-capture gate.
                    disabled={isSharing || isSaving || !ready || (saveMode === 'native-share' && isPrecapturing)}
                    icon={<Icon name="download" size={20} />}
                >
                    {t('saveImage')}
                </Button>
            )}
            {error && (
                <p className="text-center text-body-xs text-red" role="alert">
                    {error}
                </p>
            )}
        </>
    )
}

export default ShareAssetActions

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
 * before composing the post.
 */

import { type FC, type RefObject, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { captureShareAsset, canShareImageFiles, downloadBlob } from './captureShareAsset'
import { shareCardOnTwitter } from './share.utils'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

interface Props {
    /** Ref to the native-size inner element of <ScaledShareAsset />. */
    captureRef: RefObject<HTMLDivElement | null>
    /** PostHog event source tag ("celebration" | "history-replay"). */
    source: string
    /** Optional filename for the downloaded PNG. */
    filename?: string
    /** Caption text passed to the native share sheet (e.g. "I got my Peanut card. shhhh."). */
    shareText: string
}

export const ShareAssetActions: FC<Props> = ({
    captureRef,
    source,
    filename = 'peanut-card.png',
    shareText,
}) => {
    const [isSharing, setIsSharing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    const [error, setError] = useState<string | null>(null)

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
                })
                shareCardOnTwitter()
                return
            }
            const node = captureRef.current
            if (!node) throw new Error('share asset not yet rendered — try again in a moment')
            const blob = await captureShareAsset(node)
            const file = new File([blob], filename, { type: 'image/png' })
            await navigator.share({ text: shareText, files: [file] })
            posthog.capture(ANALYTICS_EVENTS.CARD_SHARE_ASSET_SHARED, {
                source,
                method: 'native-share-with-file',
            })
        } catch (err) {
            // AbortError = user cancelled the share sheet. Don't show an
            // error in that case; do log other failures.
            if ((err as Error).name !== 'AbortError') {
                console.error('[share-asset] share failed', err)
                setError((err as Error).message ?? 'Share failed')
                posthog.capture(ANALYTICS_EVENTS.CARD_SHARE_ASSET_FAILED, {
                    source,
                    action: 'share',
                    error: (err as Error).message ?? 'unknown',
                })
            }
        } finally {
            setIsSharing(false)
        }
    }

    const handleSave = async (): Promise<void> => {
        setError(null)
        setIsSaving(true)
        try {
            const node = captureRef.current
            if (!node) throw new Error('share asset not yet rendered — try again in a moment')
            const blob = await captureShareAsset(node)
            downloadBlob(blob, filename)
            posthog.capture(ANALYTICS_EVENTS.CARD_SHARE_ASSET_SAVED, { source })
        } catch (err) {
            console.error('[share-asset] save failed', err)
            setError((err as Error).message ?? 'Save failed')
            posthog.capture(ANALYTICS_EVENTS.CARD_SHARE_ASSET_FAILED, {
                source,
                action: 'save',
                error: (err as Error).message ?? 'unknown',
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
                disabled={isSharing || isSaving}
                icon={<Icon name="share" size={18} />}
            >
                Share
            </Button>
            <Button
                onClick={handleSave}
                variant="stroke"
                className="w-full"
                loading={isSaving}
                disabled={isSharing || isSaving}
                icon={<Icon name="download" size={18} />}
            >
                Save image
            </Button>
            {error && (
                <p className="text-center text-xs text-red" role="alert">
                    {error}
                </p>
            )}
        </>
    )
}

export default ShareAssetActions

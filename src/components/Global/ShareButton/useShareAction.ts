'use client'

import { useToast } from '@/components/0_Bruddle/Toast'
import * as Sentry from '@sentry/nextjs'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import { beginClipboardCopy, copyTextToClipboard } from '@/utils/clipboard.utils'
import { isNativeBridge } from '@/utils/capacitor'

export type ShareActionOptions = {
    title?: string
    text?: string
    onSuccess?: () => void
    onError?: (error: Error) => void
} & (
    | { url: string; generateUrl?: undefined; generateText?: undefined }
    | { generateUrl: () => Promise<string>; url?: undefined; generateText?: undefined }
    | { generateText: () => Promise<string>; url?: undefined; generateUrl?: undefined }
)

/**
 * opens the os share sheet, or returns undefined when there is none. web share
 * needs the click's user activation, so call it before any slow await. the
 * native plugin has no such limit and covers android's webview, which has no
 * navigator.share; binaries shipped before the plugin fall back to web share.
 * settles with the error instead of rejecting, so an early failure is never
 * reported as unhandled while the caller is still copying.
 */
function openShareSheet(data: ShareData): Promise<Error | null> | undefined {
    let sharing: Promise<void> | undefined
    if (isNativeBridge() && window.Capacitor?.isPluginAvailable?.('Share')) {
        sharing = import('@capacitor/share').then(async ({ Share }) => {
            await Share.share({ title: data.title, text: data.text, url: data.url }).catch((err: unknown) => {
                // the plugin rejects a dismissed sheet with "Share canceled"
                if (err instanceof Error && /cancel/i.test(err.message)) err.name = 'AbortError'
                throw err
            })
        })
    } else {
        sharing = navigator.share?.(data)
    }
    return sharing?.then(
        () => null,
        (error: unknown) => (error instanceof Error ? error : new Error(String(error)))
    )
}

/**
 * the share behavior behind ShareButton, as a hook so non-button surfaces
 * (the receipt's more-actions drawer rows) reuse it without nesting buttons
 * (TASK-22452). copies to the clipboard and opens the share sheet.
 */
export function useShareAction({
    url,
    generateUrl,
    generateText,
    title = 'Peanut',
    text,
    onSuccess,
    onError,
}: ShareActionOptions): () => Promise<void> {
    const t = useTranslations('global')
    const toast = useToast()

    return useCallback(async () => {
        // reserved before the await: WebKit rejects a clipboard write once the
        // click's user activation is spent, and generating the url spends it
        const pendingCopy = beginClipboardCopy()

        let shareUrl: string | undefined
        let shareText: string | undefined
        try {
            shareUrl = url ?? (generateUrl ? await generateUrl() : undefined)
            shareText = generateText ? await generateText() : text
        } catch (error) {
            // there is nothing to copy — release the reservation rather than
            // leaving the browser holding a write that never settles
            pendingCopy.cancel()
            const err = error instanceof Error ? error : new Error(String(error))
            console.error('Sharing error:', error)
            Sentry.captureException(error)
            toast.error(t('shareButton.sharingFailed'))
            onError?.(err)
            return
        }

        let copied = false

        try {
            const shareData: ShareData = { title }
            if (shareText) shareData.text = shareText
            if (shareUrl) shareData.url = shareUrl
            // opened before the copy settles: awaiting the clipboard write
            // spends the click's user activation and the browser then refuses
            // the share sheet, leaving only the copy (TASK-23176)
            const sharing = openShareSheet(shareData)

            // always copy to clipboard too (works on both desktop and mobile)
            const contentToCopy = shareUrl || shareText || ''
            copied = await pendingCopy.resolve(contentToCopy)
            if (copied) {
                toast.info(shareUrl ? t('shareButton.linkCopied') : t('shareButton.textCopied'))
            }

            const shareError = await sharing
            if (shareError) throw shareError

            if (!sharing && !copied) {
                const error = new Error('Clipboard copy failed and the Web Share API is unavailable')
                toast.error(t('shareButton.sharingFailed'))
                onError?.(error)
                return
            }

            onSuccess?.()
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error))
            // a cancelled share sheet is still a success when the copy above
            // already landed and toasted — the content is on the clipboard.
            if (err.name === 'AbortError') {
                if (copied) onSuccess?.()
                else pendingCopy.cancel()
                return
            }

            console.error('Sharing error:', error)
            Sentry.captureException(error)

            // if we didn't copy earlier, try now
            if (!copied) {
                pendingCopy.cancel()
                const contentToCopy = shareUrl || shareText || ''
                const fallbackCopied = await copyTextToClipboard(contentToCopy)
                if (fallbackCopied) {
                    toast.info(shareUrl ? t('shareButton.linkCopied') : t('shareButton.textCopied'))
                } else {
                    toast.error(t('shareButton.sharingFailed'))
                }
            }

            onError?.(err)
        }
    }, [url, generateUrl, generateText, title, text, onSuccess, onError, t, toast])
}

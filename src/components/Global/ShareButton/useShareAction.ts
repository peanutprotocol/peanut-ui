'use client'

import { useToast } from '@/components/0_Bruddle/Toast'
import * as Sentry from '@sentry/nextjs'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import { beginClipboardCopy, copyTextToClipboard } from '@/utils/clipboard.utils'

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
 * the share behavior behind ShareButton, as a hook so non-button surfaces
 * (the receipt's more-actions drawer rows) reuse it without nesting buttons
 * (TASK-22452). clipboard-first + web-share, byte-for-byte the logic that
 * lived inside ShareButton.
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
            // always copy to clipboard first (works on both desktop and mobile)
            const contentToCopy = shareUrl || shareText || ''
            copied = await pendingCopy.resolve(contentToCopy)
            if (copied) {
                toast.info(shareUrl ? t('shareButton.linkCopied') : t('shareButton.textCopied'))
            }

            // then try to open the share dialog if available (bonus for mobile)
            if (navigator.share) {
                const shareData: ShareData = { title }
                if (shareText) shareData.text = shareText
                if (shareUrl) shareData.url = shareUrl

                await navigator.share(shareData)
            }

            if (!navigator.share && !copied) {
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

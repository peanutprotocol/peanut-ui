'use client'

import { useToast } from '@/components/0_Bruddle/Toast'
import * as Sentry from '@sentry/nextjs'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import { Icon } from '../Icons/Icon'
import { Button, type ButtonVariant } from '@/components/0_Bruddle/Button'
import { copyTextToClipboard } from '@/utils/clipboard.utils'

type ShareButtonProps = {
    title?: string
    text?: string
    onSuccess?: () => void
    onError?: (error: Error) => void
    children?: React.ReactNode
    className?: string
    variant?: ButtonVariant
    iconPosition?: 'left' | 'right'
    showIcon?: boolean
} & (
    | { url: string; generateUrl?: undefined; generateText?: undefined }
    | { generateUrl: () => Promise<string>; url?: undefined; generateText?: undefined }
    | { generateText: () => Promise<string>; url?: undefined; generateUrl?: undefined }
)

/**
 * A reusable share button component that uses the Web Share API with clipboard fallback
 */
const ShareButton = ({
    url,
    generateUrl,
    generateText,
    title = 'Peanut',
    text,
    onSuccess,
    onError,
    children,
    className = '',
    variant = 'purple',
    iconPosition = 'left',
    showIcon = true,
}: ShareButtonProps) => {
    const t = useTranslations('global')
    const toast = useToast()

    const handleShare = useCallback(async () => {
        const shareUrl = url ?? (generateUrl ? await generateUrl() : undefined)
        const shareText = generateText ? await generateText() : text
        let copied = false

        try {
            // ALWAYS copy to clipboard first (works on both desktop and mobile)
            const contentToCopy = shareUrl || shareText || ''
            copied = await copyTextToClipboard(contentToCopy)
            if (copied) {
                toast.info(shareUrl ? t('shareButton.linkCopied') : t('shareButton.textCopied'))
            }

            // THEN try to open share dialog if available (bonus for mobile users)
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
            // A cancelled share sheet is still a success when the copy above
            // already landed and toasted — the content is on the clipboard.
            if (err.name === 'AbortError') {
                if (copied) onSuccess?.()
                return
            }

            console.error('Sharing error:', error)
            Sentry.captureException(error)

            // If we didn't copy earlier, try now
            if (!copied) {
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

    return (
        <Button
            variant={variant}
            className={`flex items-center justify-center gap-1 ${className}`}
            onClick={handleShare}
            shadowType="primary"
            shadowSize="4"
        >
            <span className="flex items-center gap-2">
                {showIcon && iconPosition === 'left' && <Icon name="share" size={18} />}
                {children ?? t('shareButton.share')}
                {showIcon && iconPosition === 'right' && <Icon name="share" size={18} />}
            </span>
        </Button>
    )
}

export default ShareButton

'use client'

import { useToast } from '@/components/0_Bruddle/Toast'
import * as Sentry from '@sentry/nextjs'
import { useCallback } from 'react'
import { Icon } from '../Icons/Icon'
import { Button, type ButtonVariant } from '@/components/0_Bruddle/Button'

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
    children = 'Share',
    className = '',
    variant = 'purple',
    iconPosition = 'left',
    showIcon = true,
}: ShareButtonProps) => {
    const toast = useToast()

    const copyTextToClipboardWithFallback = async (text: string) => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text)
                return true
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea')
                textArea.value = text
                textArea.style.position = 'fixed'
                textArea.style.left = '-999999px'
                textArea.style.top = '-999999px'
                document.body.appendChild(textArea)
                textArea.focus()
                textArea.select()
                document.execCommand('copy')
                document.body.removeChild(textArea)
                return true
            }
        } catch (err) {
            console.error('Failed to copy: ', err)
            return false
        }
    }

    const handleShare = useCallback(async () => {
        const shareUrl = url ?? (generateUrl ? await generateUrl() : undefined)
        const shareText = generateText ? await generateText() : text
        let copied = false

        try {
            // ALWAYS copy to clipboard first (works on both desktop and mobile)
            const contentToCopy = shareUrl || shareText || ''
            copied = await copyTextToClipboardWithFallback(contentToCopy)
            if (copied) {
                toast.info(shareUrl ? 'Link copied' : 'Text copied')
            }

            // THEN try to open share dialog if available (bonus for mobile users)
            if (navigator.share) {
                const shareData: ShareData = { title }
                if (shareText) shareData.text = shareText
                if (shareUrl) shareData.url = shareUrl

                await navigator.share(shareData)
            }

            onSuccess?.()
        } catch (error: any) {
            // Only show error toast for actual sharing failures (not user cancellations)
            if (error.name !== 'AbortError') {
                console.error('Sharing error:', error)
                Sentry.captureException(error)

                // If we didn't copy earlier, try now
                if (!copied) {
                    const contentToCopy = shareUrl || shareText || ''
                    const fallbackCopied = await copyTextToClipboardWithFallback(contentToCopy)
                    if (fallbackCopied) {
                        toast.info(shareUrl ? 'Link copied' : 'Text copied')
                    } else {
                        toast.error('Sharing failed')
                    }
                }

                onError?.(error)
            }
        }
    }, [url, generateUrl, generateText, title, text, onSuccess, onError])

    return (
        <Button
            variant={variant}
            className={`flex items-center justify-center gap-1 ${className}`}
            onClick={handleShare}
            shadowType="primary"
            shadowSize="4"
        >
            <span className="flex items-center gap-2">
                {showIcon && iconPosition === 'left' && <Icon name="share" />}
                {children}
                {showIcon && iconPosition === 'right' && <Icon name="share" />}
            </span>
        </Button>
    )
}

export default ShareButton

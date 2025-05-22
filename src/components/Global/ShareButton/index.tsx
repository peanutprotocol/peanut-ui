'use client'

import { Button, type ButtonVariant } from '@/components/0_Bruddle'
import Icon from '../Icon'
import { useToast } from '@/components/0_Bruddle/Toast'
import * as Sentry from '@sentry/nextjs'

interface ShareButtonProps {
    url: string
    title?: string
    text?: string
    onSuccess?: () => void
    onError?: (error: Error) => void
    children?: React.ReactNode
    className?: string
    variant?: ButtonVariant
    iconPosition?: 'left' | 'right'
    showIcon?: boolean
}

/**
 * A reusable share button component that uses the Web Share API with clipboard fallback
 */
const ShareButton = ({
    url,
    title = 'Peanut Protocol',
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

    const handleShare = async () => {
        try {
            // Check if Web Share API is available
            if (!navigator.share) {
                // Fallback to clipboard
                const copied = await copyTextToClipboardWithFallback(url)
                if (copied) {
                    toast.info('Link copied')
                    onSuccess?.()
                } else {
                    throw new Error('Failed to copy to clipboard')
                }
                return
            }

            onSuccess?.()

            // Use Web Share API
            await navigator.share({
                title,
                text,
                url,
            })
        } catch (error: any) {
            // Only show error toast for actual sharing failures (not user cancellations)
            if (error.name !== 'AbortError') {
                console.error('Sharing error:', error)
                Sentry.captureException(error)

                // Try clipboard fallback if sharing fails
                const copied = await copyTextToClipboardWithFallback(url)
                if (copied) {
                    toast.info('Link copied')
                } else {
                    toast.error('Sharing failed')
                }

                onError?.(error)
            }
        }
    }

    return (
        <Button
            variant={variant}
            className={`flex items-center justify-center gap-1 ${className}`}
            onClick={handleShare}
            shadowType="primary"
            shadowSize="4"
        >
            <span>
                {showIcon && iconPosition === 'left' && <Icon name="share" />}
                {children}
                {showIcon && iconPosition === 'right' && <Icon name="share" />}
            </span>
        </Button>
    )
}

export default ShareButton

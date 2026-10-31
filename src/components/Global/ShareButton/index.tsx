'use client'

import { Icon } from '../Icons/Icon'
import { Button, type ButtonVariant } from '@/components/0_Bruddle/Button'
import { useTranslations } from 'next-intl'
import { useShareAction, type ShareActionOptions } from './useShareAction'

type ShareButtonProps = ShareActionOptions & {
    children?: React.ReactNode
    className?: string
    variant?: ButtonVariant
    iconPosition?: 'left' | 'right'
    showIcon?: boolean
    /** Runs on the tap, before the share starts: the place to record that the
     *  user wanted to share, whatever the sheet or the clipboard do next. */
    onClick?: () => void
}

/**
 * A reusable share button component that uses the Web Share API with clipboard fallback
 */
const ShareButton = ({
    children,
    className = '',
    variant = 'primary',
    iconPosition = 'left',
    showIcon = true,
    onClick,
    ...shareOptions
}: ShareButtonProps) => {
    const t = useTranslations('global')
    // the behavior lives in the hook so drawer rows can share it (TASK-22452)
    const handleShare = useShareAction(shareOptions)

    return (
        <Button
            variant={variant}
            className={`flex items-center justify-center gap-1 ${className}`}
            onClick={() => {
                onClick?.()
                void handleShare()
            }}
            shadowSize="4"
        >
            <span className="flex items-center gap-2">
                {showIcon && iconPosition === 'left' && <Icon name="share" size={20} />}
                {children ?? t('shareButton.share')}
                {showIcon && iconPosition === 'right' && <Icon name="share" size={20} />}
            </span>
        </Button>
    )
}

export default ShareButton

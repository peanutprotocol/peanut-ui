import React, { useState, forwardRef, useImperativeHandle, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { twMerge } from '@/utils/tw'
import { Icon } from '../Icons/Icon'
import { Button, type ButtonSize } from '@/components/0_Bruddle/Button'
import { useToast } from '@/components/0_Bruddle/Toast'
import { copyTextToClipboard } from '@/utils/clipboard.utils'

export interface CopyToClipboardRef {
    copy: () => void
}

interface Props {
    textToCopy: string
    fill?: string
    className?: string
    iconSize?: '2' | '3' | '4' | '5' | '6' | '8'
    type?: 'button' | 'icon'
    buttonSize?: ButtonSize
    onCopy?: () => void
}

const CopyToClipboard = forwardRef<CopyToClipboardRef, Props>(
    ({ textToCopy, fill = 'black', className, iconSize = '6', type = 'icon', buttonSize, onCopy }, ref) => {
        const t = useTranslations('global')
        const toast = useToast()
        const [copied, setCopied] = useState(false)

        const copy = useCallback(async () => {
            const didCopy = await copyTextToClipboard(textToCopy)
            if (!didCopy) {
                toast.error(t('copyToClipboard.copyFailed'))
                return
            }
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
            onCopy?.()
        }, [textToCopy, onCopy, toast, t])

        useImperativeHandle(ref, () => ({ copy }), [copy])

        const handleCopy = (e: React.MouseEvent<SVGElement | HTMLButtonElement, MouseEvent>) => {
            e.stopPropagation()
            copy()
        }

        // convert tailwind size to pixels (2=8px, 3=12px, 4=16px, 5=20px, 6=24px, 8=32px)
        const sizeMap: Record<string, number> = {
            '2': 8,
            '3': 12,
            '4': 16,
            '5': 20,
            '6': 24,
            '8': 32,
        }

        const iconSizePx = sizeMap[iconSize] || 24

        if (type === 'button') {
            return (
                <Button
                    size={buttonSize}
                    className={className}
                    onClick={handleCopy}
                    icon={copied ? 'check' : 'copy'}
                    shadowSize="4"
                    variant="primary-soft"
                >
                    <p className="text-body-s">{t('copyToClipboard.copyCode')}</p>
                </Button>
            )
        }

        return (
            <Icon
                name={copied ? 'check' : 'copy'}
                size={iconSizePx}
                className={twMerge('cursor-pointer hover:opacity-80', className)}
                fill={fill ? fill : 'white'}
                onClick={handleCopy}
            />
        )
    }
)

CopyToClipboard.displayName = 'CopyToClipboard'

export default CopyToClipboard

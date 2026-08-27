'use client'
import { Button, type ButtonVariant } from '@/components/0_Bruddle/Button'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { copyTextToClipboardWithFallback } from '@/utils/general.utils'
import { useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'
import { twMerge } from '@/utils/tw'

interface CopyFieldProps {
    text: string
    variant?: ButtonVariant
    shadowSize?: '4' | '6' | '8'
    disabled?: boolean
    onDisabledClick?: () => void
}

const timeoutDuration = 3000

const CopyField = ({ text, variant, shadowSize, disabled, onDisabledClick }: CopyFieldProps) => {
    const t = useTranslations('global')
    const [isCopied, setIsCopied] = useState(false)

    const handleClick = useCallback(() => {
        if (disabled && onDisabledClick) {
            onDisabledClick()
            return
        }

        copyTextToClipboardWithFallback(text)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), timeoutDuration)
    }, [disabled, onDisabledClick, text])

    return (
        <div className="flex w-full flex-row items-stretch justify-between gap-2">
            <BaseInput disabled value={text} className="h-10" />
            <Button
                disabled={disabled && !onDisabledClick}
                variant={variant ? variant : 'stroke'}
                className="h-10 w-fit"
                onClick={handleClick}
                shadowSize={shadowSize}
            >
                {/* both labels share one grid cell so the button keeps the width of the longer one */}
                <span className="grid text-center">
                    <span
                        className={twMerge('col-start-1 row-start-1', isCopied && 'invisible')}
                        aria-hidden={isCopied}
                    >
                        {t('copyField.copy')}
                    </span>
                    <span
                        className={twMerge('col-start-1 row-start-1', !isCopied && 'invisible')}
                        aria-hidden={!isCopied}
                    >
                        {t('copyField.copied')}
                    </span>
                </span>
            </Button>
        </div>
    )
}

export default CopyField

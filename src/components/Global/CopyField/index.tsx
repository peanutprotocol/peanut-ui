'use client'
import { Button, ButtonVariant } from '@/components/0_Bruddle'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import * as utils from '@/utils'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface CopyFieldProps {
    text: string
    variant?: ButtonVariant
    shadowSize?: '4' | '6' | '8'
    displayText?: string
    disabled?: boolean
    onDisabledClick?: () => void
}

const CopyField = ({ text, variant, shadowSize, displayText, disabled, onDisabledClick }: CopyFieldProps) => {
    const [isCopied, setIsCopied] = useState(false)

    const handleClick = () => {
        if (disabled && onDisabledClick) {
            onDisabledClick()
            return
        }

        utils.copyTextToClipboardWithFallback(text)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 3000)
    }

    return (
        <div className="flex w-full flex-row items-stretch justify-between gap-2">
            <BaseInput disabled value={displayText ? displayText : text} className="h-10" />
            <Button
                disabled={disabled && !onDisabledClick}
                variant={variant ? variant : 'stroke'}
                className={twMerge(
                    'h-10 w-fit',
                    disabled &&
                        'cursor-not-allowed bg-gray-200 text-black opacity-80 focus-within:bg-gray-300 focus-within:text-black active:bg-gray-300 active:text-black'
                )}
                onClick={handleClick}
                shadowSize={shadowSize}
            >
                {isCopied ? 'Copied' : 'Copy'}
            </Button>
        </div>
    )
}

export default CopyField

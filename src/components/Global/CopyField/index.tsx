'use client'
import { Button, ButtonVariant } from '@/components/0_Bruddle'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import * as utils from '@/utils'
import { useState } from 'react'

interface CopyFieldProps {
    text: string
    variant?: ButtonVariant
    shadowSize?: '4' | '6' | '8'
    displayText?: string
    disabled?: boolean
}

const CopyField = ({ text, variant, shadowSize, displayText, disabled }: CopyFieldProps) => {
    const [isCopied, setIsCopied] = useState(false)

    return (
        <div className="flex w-full flex-row items-stretch justify-between gap-2">
            <BaseInput disabled value={displayText ? displayText : text} className="h-10" />
            <Button
                disabled={disabled}
                variant={variant ? variant : 'stroke'}
                className="h-10 w-fit"
                onClick={() => {
                    utils.copyTextToClipboardWithFallback(text)
                    setIsCopied(true)
                }}
                shadowSize={shadowSize}
            >
                {isCopied ? 'Copied' : 'Copy'}
            </Button>
        </div>
    )
}

export default CopyField

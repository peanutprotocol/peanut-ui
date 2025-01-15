'use client'
import { Button } from '@/components/0_Bruddle'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import * as utils from '@/utils'
import { useState } from 'react'

interface CopyFieldProps {
    text: string
}

const CopyField = ({ text }: CopyFieldProps) => {
    const [isCopied, setIsCopied] = useState(false)

    return (
        <div className="flex w-full flex-row items-stretch justify-between gap-2">
            <BaseInput disabled value={text} className="h-10" />
            <Button
                variant="stroke"
                className="h-10 w-fit"
                onClick={() => {
                    utils.copyTextToClipboardWithFallback(text)
                    setIsCopied(true)
                }}
            >
                {isCopied ? 'Copied' : 'Copy'}
            </Button>
        </div>
    )
}

export default CopyField

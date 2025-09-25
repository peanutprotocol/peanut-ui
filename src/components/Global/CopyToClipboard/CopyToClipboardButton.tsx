'use client'
import { Button, ButtonSize } from '@/components/0_Bruddle'
import React, { useState } from 'react'

const CopyToClipboardButton = ({
    textToCopy,
    className,
    size,
}: {
    textToCopy: string
    className?: string
    size?: ButtonSize
}) => {
    const [copied, setCopied] = useState(false)

    const handleCopy = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.stopPropagation()
        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }
    return (
        <Button
            size={size}
            className={className}
            onClick={handleCopy}
            icon={copied ? 'check' : 'copy'}
            shadowSize="4"
            variant="primary-soft"
        >
            <p className="text-xs"> Copy code</p>
        </Button>
    )
}

export default CopyToClipboardButton

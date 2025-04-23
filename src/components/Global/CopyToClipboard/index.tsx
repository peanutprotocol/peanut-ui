import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '../Icons/Icon'

interface Props {
    textToCopy: string
    fill?: string
    className?: string
    iconSize?: '2' | '4' | '6' | '8'
}

const CopyToClipboard = ({ textToCopy, fill, className, iconSize = '6' }: Props) => {
    const [copied, setCopied] = useState(false)

    const handleCopy = (e: React.MouseEvent<SVGElement>) => {
        e.stopPropagation()
        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    return (
        <Icon
            name={copied ? 'check' : 'copy'}
            className={twMerge(`h-${iconSize} w-${iconSize} hover:opacity-80`, className)}
            fill={fill ? fill : 'white'}
            onClick={handleCopy}
        />
    )
}

export default CopyToClipboard

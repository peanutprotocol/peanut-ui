import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Icon from '../Icon'

interface Props {
    textToCopy: string
    fill?: string
    className?: string
}

const CopyToClipboard = ({ textToCopy, fill, className }: Props) => {
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
            name={copied ? 'check' : 'content-copy'}
            className={twMerge('h-6 w-6 hover:opacity-80', className)}
            fill={fill ? fill : 'white'}
            onClick={handleCopy}
        />
    )
}

export default CopyToClipboard

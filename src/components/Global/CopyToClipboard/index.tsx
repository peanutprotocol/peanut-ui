import React, { useState } from 'react'
import Icon from '../Icon'

const CopyToClipboard = ({ textToCopy }: { textToCopy: string }) => {
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
            className="h-6 w-6 hover:opacity-80"
            fill="white"
            onClick={handleCopy}
        />
    )
}

export default CopyToClipboard

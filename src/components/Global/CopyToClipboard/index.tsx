import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '../Icons/Icon'
import { Button, type ButtonSize } from '@/components/0_Bruddle'

interface Props {
    textToCopy: string
    fill?: string
    className?: string
    iconSize?: '2' | '3' | '4' | '6' | '8'
    type?: 'button' | 'icon'
    buttonSize?: ButtonSize
}

const CopyToClipboard = ({ textToCopy, fill, className, iconSize = '6', type = 'icon', buttonSize }: Props) => {
    const [copied, setCopied] = useState(false)

    const handleCopy = (e: React.MouseEvent<SVGElement | HTMLButtonElement, MouseEvent>) => {
        e.stopPropagation()
        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

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
                <p className="text-sm"> Copy code</p>
            </Button>
        )
    }

    return (
        <Icon
            name={copied ? 'check' : 'copy'}
            className={twMerge(
                `min-h-${iconSize} min-w-${iconSize} h-${iconSize} w-${iconSize} cursor-pointer hover:opacity-80`,
                className
            )}
            fill={fill ? fill : 'white'}
            onClick={handleCopy}
        />
    )
}

export default CopyToClipboard

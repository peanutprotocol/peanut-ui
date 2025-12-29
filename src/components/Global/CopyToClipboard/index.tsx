import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '../Icons/Icon'
import { Button, type ButtonSize } from '@/components/0_Bruddle/Button'

interface Props {
    textToCopy: string
    fill?: string
    className?: string
    iconSize?: '2' | '3' | '4' | '6' | '8'
    type?: 'button' | 'icon'
    buttonSize?: ButtonSize
}

const CopyToClipboard = ({
    textToCopy,
    fill = 'black',
    className,
    iconSize = '6',
    type = 'icon',
    buttonSize,
}: Props) => {
    const [copied, setCopied] = useState(false)

    const handleCopy = (e: React.MouseEvent<SVGElement | HTMLButtonElement, MouseEvent>) => {
        e.stopPropagation()
        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    // convert tailwind size to pixels (2=8px, 3=12px, 4=16px, 6=24px, 8=32px)
    const sizeMap: Record<string, number> = {
        '2': 8,
        '3': 12,
        '4': 16,
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
                <p className="text-sm"> Copy code</p>
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

export default CopyToClipboard

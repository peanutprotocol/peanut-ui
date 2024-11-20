import React from 'react'
import { twMerge } from 'tailwind-merge'

type BadgeColor = 'yellow' | 'pink' | 'purple' | 'green' | 'black'
type BadgeVariant = 'stroke' | 'default'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    color?: BadgeColor
    variant?: BadgeVariant
}

const badgeVariants: Record<BadgeVariant, string> = {
    stroke: 'label-stroke',
    default: 'label',
}

const badgeColors: Record<BadgeColor, Record<BadgeVariant, string>> = {
    yellow: {
        stroke: 'label-stroke-yellow',
        default: 'label-yellow',
    },
    pink: {
        stroke: 'label-stroke-pink',
        default: 'label',
    },
    purple: {
        stroke: 'label-stroke-purple',
        default: 'label-purple',
    },
    green: {
        stroke: 'label-stroke-green',
        default: 'label-green',
    },
    black: {
        stroke: 'label-stroke',
        default: 'label-black',
    },
}

export const Badge: React.FC<BadgeProps> = ({
    children,
    className,
    color = 'black',
    variant = 'default',
    ...props
}) => {
    const badgeClasses = twMerge(badgeVariants[variant], badgeColors[color][variant], className)

    return (
        <div className={badgeClasses} {...props}>
            {children}
        </div>
    )
}

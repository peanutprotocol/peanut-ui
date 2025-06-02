import React from 'react'
import { twMerge } from 'tailwind-merge'

export type CardPosition = 'single' | 'first' | 'middle' | 'last'

interface CardProps {
    children: React.ReactNode
    position?: CardPosition
    className?: string
    onClick?: () => void
    border?: boolean
}

export function getCardPosition(index: number, totalItems: number): CardPosition {
    if (totalItems === 1) return 'single'
    if (index === 0) return 'first'
    if (index === totalItems - 1) return 'last'
    return 'middle'
}

const Card: React.FC<CardProps> = ({ children, position = 'single', className = '', onClick, border = true }) => {
    const getBorderRadius = () => {
        switch (position) {
            case 'single':
                return 'rounded-sm'
            case 'first':
                return 'rounded-t-sm'
            case 'last':
                return 'rounded-b-sm'
            case 'middle':
                return ''
            default:
                return 'rounded-sm'
        }
    }

    const getBorder = () => {
        if (!border) return ''

        switch (position) {
            case 'single':
                return 'border border-black'
            case 'first':
                return 'border border-black'
            case 'middle':
                return 'border border-black border-t-0'
            case 'last':
                return 'border border-black border-t-0'
            default:
                return 'border border-black'
        }
    }

    return (
        <div
            className={twMerge('w-full bg-white px-4 py-2', getBorderRadius(), getBorder(), className)}
            onClick={onClick}
        >
            {children}
        </div>
    )
}

export default Card

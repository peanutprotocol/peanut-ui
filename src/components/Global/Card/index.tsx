import React from 'react'
import { twMerge } from 'tailwind-merge'
import { type CardPosition } from './card.utils'

interface CardProps {
    children: React.ReactNode
    position?: CardPosition
    className?: string
    onClick?: () => void
    border?: boolean
    ref?: React.Ref<HTMLDivElement>
    'data-testid'?: string
    role?: React.AriaRole
    tabIndex?: number
    onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>
    'aria-disabled'?: boolean
}

const Card: React.FC<CardProps> = ({
    children,
    position = 'single',
    className = '',
    onClick,
    border = true,
    ref,
    'data-testid': dataTestId,
    role,
    tabIndex,
    onKeyDown,
    'aria-disabled': ariaDisabled,
}) => {
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
                return 'border border-border-default'
            case 'first':
                return 'border border-border-default'
            case 'middle':
                return 'border border-border-default border-t-0'
            case 'last':
                return 'border border-border-default border-t-0'
            default:
                return 'border border-border-default'
        }
    }

    return (
        <div
            ref={ref}
            className={twMerge('w-full bg-white px-4 py-2', getBorderRadius(), getBorder(), className)}
            onClick={onClick}
            data-testid={dataTestId}
            role={role}
            tabIndex={tabIndex}
            onKeyDown={onKeyDown}
            aria-disabled={ariaDisabled}
        >
            {children}
        </div>
    )
}

export default Card

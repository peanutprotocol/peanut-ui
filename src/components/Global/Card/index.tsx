import React from 'react'
import { twMerge } from '@/utils/tw'
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
    'aria-label'?: string
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
    'aria-label': ariaLabel,
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

    // clickable cards default to button semantics so keyboard users can reach
    // and activate them; explicit props still win
    const interactive = !!onClick
    const defaultKeyDown: React.KeyboardEventHandler<HTMLDivElement> | undefined = interactive
        ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onClick()
              }
          }
        : undefined

    return (
        <div
            ref={ref}
            className={twMerge('w-full bg-white px-4 py-2', getBorderRadius(), getBorder(), className)}
            onClick={onClick}
            data-testid={dataTestId}
            role={role ?? (interactive ? 'button' : undefined)}
            tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
            onKeyDown={onKeyDown ?? defaultKeyDown}
            aria-disabled={ariaDisabled}
            aria-label={ariaLabel}
        >
            {children}
        </div>
    )
}

export default Card

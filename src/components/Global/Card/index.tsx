import React from 'react'
import { twMerge } from '@/utils/tw'
import { type CardPosition } from './card.utils'

interface CardProps {
    asButton?: boolean
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
    'aria-pressed'?: boolean
}

const Card: React.FC<CardProps> = ({
    children,
    asButton = false,
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
    'aria-pressed': ariaPressed,
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

    const Element = asButton ? 'button' : 'div'
    return (
        <Element
            type={asButton ? 'button' : undefined}
            disabled={asButton ? ariaDisabled : undefined}
            ref={ref as React.Ref<HTMLDivElement & HTMLButtonElement>}
            className={twMerge('w-full bg-white px-4 py-2 text-left', getBorderRadius(), getBorder(), className)}
            onClick={onClick}
            data-testid={dataTestId}
            role={role ?? (interactive ? 'button' : undefined)}
            tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
            onKeyDown={
                (asButton ? undefined : (onKeyDown ?? defaultKeyDown)) as
                    | React.KeyboardEventHandler<HTMLDivElement & HTMLButtonElement>
                    | undefined
            }
            aria-disabled={ariaDisabled}
            aria-label={ariaLabel}
            aria-pressed={ariaPressed}
        >
            {children}
        </Element>
    )
}

export default Card

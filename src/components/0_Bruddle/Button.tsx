'use client'
import React, { forwardRef, useCallback, useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon, type IconName } from '../Global/Icons/Icon'
import Loading from '../Global/Loading'
import { useHaptic } from 'use-haptic'
import { useLongPress } from '@/hooks/useLongPress'

export type ButtonVariant =
    | 'purple'
    | 'dark'
    | 'stroke'
    | 'transparent-light'
    | 'transparent-dark'
    | 'transparent'
    | 'primary-soft'
export type ButtonSize = 'small' | 'medium' | 'large'
type ButtonShape = 'default' | 'square'
type ShadowSize = '3' | '4' | '6' | '8'
type ShadowType = 'primary' | 'secondary'

/**
 * Primary button component.
 *
 * @prop variant - Visual style. 'purple' for primary CTAs, 'stroke' for secondary.
 * @prop size - Height override. Omit for default h-13 (tallest). 'large' is h-10 (shorter!).
 * @prop shadowSize - Drop shadow depth. '4' is standard (160+ usages).
 * @prop longPress - Hold-to-confirm behavior with progress bar animation.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant
    size?: ButtonSize
    shape?: ButtonShape
    shadowSize?: ShadowSize
    shadowType?: ShadowType
    loading?: boolean
    icon?: IconName | React.ReactNode
    iconPosition?: 'left' | 'right'
    iconClassName?: string
    iconSize?: number
    iconContainerClassName?: HTMLDivElement['className']
    longPress?: {
        duration?: number // Duration in milliseconds (default: 2000)
        onLongPress?: () => void
        onLongPressStart?: () => void
        onLongPressEnd?: () => void
    }
    disableHaptics?: boolean
}

const buttonVariants: Record<ButtonVariant, string> = {
    purple: 'btn-purple',
    dark: 'btn-dark',
    stroke: 'btn-stroke',
    'transparent-light': 'btn-transparent-light',
    'transparent-dark': 'btn-transparent-dark',
    'primary-soft': 'bg-white',
    transparent:
        'bg-transparent border-none hover:bg-transparent !active:bg-transparent focus:bg-transparent disabled:bg-transparent disabled:hover:bg-transparent',
}

const buttonSizes: Record<ButtonSize, string> = {
    small: 'btn-small',
    medium: 'btn-medium',
    /** @deprecated large (h-10) is shorter than default (h-13). Avoid for primary CTAs. */
    large: 'btn-large',
}

const buttonShadows: Record<ShadowType, Record<ShadowSize, string>> = {
    primary: {
        '3': 'btn-shadow-primary-3',
        '4': 'btn-shadow-primary-4',
        '6': 'btn-shadow-primary-6',
        '8': 'btn-shadow-primary-8',
    },
    secondary: {
        '3': 'btn-shadow-secondary-3',
        '4': 'btn-shadow-secondary-4',
        '6': 'btn-shadow-secondary-6',
        '8': 'btn-shadow-secondary-8',
    },
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            children,
            className,
            loading,
            variant = 'purple',
            size,
            shape,
            shadowSize,
            shadowType,
            icon,
            iconPosition = 'left',
            iconSize,
            iconClassName,
            iconContainerClassName,
            longPress,
            onClick,
            disableHaptics,
            ...props
        },
        ref
    ) => {
        const localRef = useRef<HTMLButtonElement>(null)
        const buttonRef = (ref as React.RefObject<HTMLButtonElement>) || localRef

        const { triggerHaptic } = useHaptic()
        const { isLongPressed, pressProgress, handlers: longPressHandlers } = useLongPress(longPress)

        useEffect(() => {
            if (!buttonRef.current) return
            buttonRef.current.setAttribute('translate', 'no')
            buttonRef.current.classList.add('notranslate')
        }, [])

        const handleClick = useCallback(
            (e: React.MouseEvent<HTMLButtonElement>) => {
                if (longPress && !isLongPressed) {
                    return
                }

                if (!disableHaptics) {
                    triggerHaptic()
                }

                onClick?.(e)
            },
            [longPress, isLongPressed, onClick, disableHaptics, triggerHaptic]
        )

        const buttonClasses = twMerge(
            `btn w-full flex items-center gap-2 transition-all duration-100 active:translate-x-[3px] active:translate-y-[${shadowSize}px] active:shadow-none notranslate`,
            buttonVariants[variant],
            variant === 'transparent' && props.disabled && 'disabled:bg-transparent disabled:border-transparent',
            size && buttonSizes[size],
            shape === 'square' && 'btn-square',
            shadowSize && buttonShadows[shadowType || 'primary'][shadowSize],

            className
        )

        const renderIcon = () => {
            if (!icon || loading) return null
            return (
                <div className={twMerge('flex size-6 items-center justify-center', iconContainerClassName)}>
                    {typeof icon === 'string' ? (
                        <Icon
                            size={iconSize}
                            name={icon as IconName}
                            className={twMerge(!iconSize && 'min-h-4 min-w-4', iconClassName)}
                        />
                    ) : (
                        icon
                    )}
                </div>
            )
        }

        // Use children as display text (no text changes for long press)
        const displayText = children

        return (
            <button
                className={twMerge(buttonClasses, 'notranslate', longPress && 'relative overflow-hidden')}
                ref={buttonRef}
                translate="no"
                onClick={handleClick}
                onMouseDown={longPress ? longPressHandlers.onMouseDown : undefined}
                onMouseUp={longPress ? longPressHandlers.onMouseUp : undefined}
                onMouseLeave={longPress ? longPressHandlers.onMouseLeave : undefined}
                onTouchStart={longPress ? longPressHandlers.onTouchStart : undefined}
                onTouchEnd={longPress ? longPressHandlers.onTouchEnd : undefined}
                onTouchCancel={longPress ? longPressHandlers.onTouchCancel : undefined}
                {...props}
            >
                {/* Progress bar for long press */}
                {longPress && pressProgress > 0 && (
                    <div
                        className="absolute inset-0 bg-gradient-to-r from-purple-400 to-purple-600 opacity-30 transition-all duration-75 ease-out"
                        style={{
                            width: `${pressProgress}%`,
                        }}
                    />
                )}

                {loading && <Loading />}
                {iconPosition === 'left' && renderIcon()}
                {displayText}
                {iconPosition === 'right' && renderIcon()}
            </button>
        )
    }
)

Button.displayName = 'Button'

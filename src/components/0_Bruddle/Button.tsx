'use client'
import React, { forwardRef, useCallback, useEffect, useRef } from 'react'
import { twMerge } from '@/utils/tw'
import { Icon, type IconName } from '../Global/Icons/Icon'
import Loading from '../Global/Loading'
import { useAppHaptic } from '@/hooks/useAppHaptic'
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
 * Primary button component. Styled to the figma button board (17802:61527):
 * pill shape, sizes l=48/m=44 (default)/s=40px, primary + stroke carry the
 * 4px shadow by default.
 *
 * @prop variant - Visual style. 'purple' = board primary, 'stroke' = board
 *   secondary, 'transparent' = board ghost. Others are legacy.
 * @prop size - Omit for medium (44px). 'large' is 48px, 'small' is 40px.
 * @prop shadowSize - Shadow depth override; '4' is already the default on
 *   purple/stroke, so passing it is a no-op kept for compatibility.
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
    'primary-soft': 'bg-white active:bg-action-primary',
    transparent:
        'bg-transparent border-none hover:bg-transparent active:bg-transparent! focus:bg-transparent disabled:bg-transparent disabled:hover:bg-transparent hover:text-action-ghost-hover hover:fill-action-ghost-hover active:text-action-ghost-hover active:fill-action-ghost-hover',
}

const buttonSizes: Record<ButtonSize, string> = {
    small: 'btn-small',
    medium: 'btn-medium',
    large: 'btn-large',
}

// board 17802:61527 icon per button size: S = 16, M = 20, L = 24. 18 was off
// the 16/20/24 icon scale entirely and matched no board row.
const buttonIconSizes: Record<ButtonSize, number> = {
    small: 16,
    medium: 20,
    large: 24,
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

        const { triggerHaptic } = useAppHaptic()
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
            // static pressed-state classes: the old `translate-y-[${shadowSize}px]`
            // template never generated a real class under the jit scanner
            'btn w-full flex items-center gap-2 transition-all duration-100 active:translate-x-1 active:translate-y-1 active:shadow-none notranslate',
            buttonVariants[variant],
            variant === 'transparent' && props.disabled && 'disabled:bg-transparent disabled:border-transparent',
            size && buttonSizes[size],
            // board icon/label gap: S is XS/4, L and M are S/8. It has to sit
            // here rather than in `.btn-small`, because @layer components loses
            // to the base `gap-2` utility — twMerge is what resolves it.
            size === 'small' && 'gap-1',
            shape === 'square' && 'btn-square',
            shadowSize && buttonShadows[shadowType || 'primary'][shadowSize],

            className
        )

        // no `size` means medium (`.btn` is h-11), so the fallback is medium's icon
        const resolvedIconSize = iconSize ?? (size && buttonIconSizes[size]) ?? buttonIconSizes.medium

        const renderIcon = () => {
            if (!icon || loading) return null
            return (
                <div className={twMerge('flex size-6 items-center justify-center', iconContainerClassName)}>
                    {typeof icon === 'string' ? (
                        <Icon size={resolvedIconSize} name={icon as IconName} className={iconClassName} />
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
                        className="from-purple-400 to-purple-600 absolute inset-0 bg-gradient-to-r opacity-30 transition-all duration-75 ease-out"
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

import React, { forwardRef, useEffect, useRef, useState, useCallback } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon, IconName } from '../Global/Icons/Icon'
import Loading from '../Global/Loading'

export type ButtonVariant =
    | 'purple'
    | 'dark'
    | 'stroke'
    | 'transparent-light'
    | 'transparent-dark'
    | 'green'
    | 'yellow'
    | 'transparent'
    | 'primary-soft'
export type ButtonSize = 'small' | 'medium' | 'large' | 'xl' | 'xl-fixed'
type ButtonShape = 'default' | 'square'
type ShadowSize = '4' | '6' | '8'
type ShadowType = 'primary' | 'secondary'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant
    size?: ButtonSize
    shape?: ButtonShape
    shadowSize?: ShadowSize
    shadowType?: ShadowType
    loading?: boolean
    icon?: IconName
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
}

const buttonVariants: Record<ButtonVariant, string> = {
    purple: 'btn-purple',
    dark: 'btn-dark',
    stroke: 'btn-stroke',
    'transparent-light': 'btn-transparent-light',
    'transparent-dark': 'btn-transparent-dark',
    green: 'bg-green-1',
    yellow: 'bg-secondary-1',
    'primary-soft': 'bg-white',
    transparent:
        'bg-transparent border-none hover:bg-transparent !active:bg-transparent focus:bg-transparent disabled:bg-transparent disabled:hover:bg-transparent',
}

const buttonSizes: Record<ButtonSize, string> = {
    small: 'btn-small',
    medium: 'btn-medium',
    large: 'btn-large',
    xl: 'btn-xl',
    'xl-fixed': 'btn-xl-fixed',
}

const buttonShadows: Record<ShadowType, Record<ShadowSize, string>> = {
    primary: {
        '4': 'btn-shadow-primary-4',
        '6': 'btn-shadow-primary-6',
        '8': 'btn-shadow-primary-8',
    },
    secondary: {
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
            ...props
        },
        ref
    ) => {
        const localRef = useRef<HTMLButtonElement>(null)
        const buttonRef = (ref as React.RefObject<HTMLButtonElement>) || localRef

        // Long press state
        const [isLongPressed, setIsLongPressed] = useState(false)
        const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null)
        const [pressProgress, setPressProgress] = useState(0)
        const [progressInterval, setProgressInterval] = useState<NodeJS.Timeout | null>(null)

        useEffect(() => {
            if (!buttonRef.current) return
            buttonRef.current.setAttribute('translate', 'no')
            buttonRef.current.classList.add('notranslate')
        }, [])

        // Long press handlers
        const handlePressStart = useCallback(() => {
            if (!longPress) return

            longPress.onLongPressStart?.()
            setPressProgress(0)

            const duration = longPress.duration || 2000
            const updateInterval = 16 // ~60fps
            const increment = (100 / duration) * updateInterval

            // Progress animation
            const progressTimer = setInterval(() => {
                setPressProgress((prev) => {
                    const newProgress = prev + increment
                    if (newProgress >= 100) {
                        clearInterval(progressTimer)
                        return 100
                    }
                    return newProgress
                })
            }, updateInterval)

            setProgressInterval(progressTimer)

            // Long press completion timer
            const timer = setTimeout(() => {
                setIsLongPressed(true)
                longPress.onLongPress?.()
                clearInterval(progressTimer)
            }, duration)

            setPressTimer(timer)
        }, [longPress])

        const handlePressEnd = useCallback(() => {
            if (!longPress) return

            if (pressTimer) {
                clearTimeout(pressTimer)
                setPressTimer(null)
            }

            if (progressInterval) {
                clearInterval(progressInterval)
                setProgressInterval(null)
            }

            if (isLongPressed) {
                longPress.onLongPressEnd?.()
                setIsLongPressed(false)
            }

            setPressProgress(0)
        }, [longPress, pressTimer, progressInterval, isLongPressed])

        const handlePressCancel = useCallback(() => {
            if (!longPress) return

            if (pressTimer) {
                clearTimeout(pressTimer)
                setPressTimer(null)
            }

            if (progressInterval) {
                clearInterval(progressInterval)
                setProgressInterval(null)
            }

            setIsLongPressed(false)
            setPressProgress(0)
        }, [longPress, pressTimer, progressInterval])

        const handleClick = useCallback(
            (e: React.MouseEvent<HTMLButtonElement>) => {
                if (longPress && !isLongPressed) {
                    // If long press is enabled but not completed, don't trigger onClick
                    return
                }
                onClick?.(e)
            },
            [longPress, isLongPressed, onClick]
        )

        // Cleanup timers on unmount
        useEffect(() => {
            return () => {
                if (pressTimer) {
                    clearTimeout(pressTimer)
                }
                if (progressInterval) {
                    clearInterval(progressInterval)
                }
            }
        }, [pressTimer, progressInterval])

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
                    <Icon
                        size={iconSize}
                        name={icon}
                        className={twMerge(!iconSize && 'min-h-4 min-w-4', iconClassName)}
                    />
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
                onMouseDown={longPress ? handlePressStart : undefined}
                onMouseUp={longPress ? handlePressEnd : undefined}
                onMouseLeave={longPress ? handlePressCancel : undefined}
                onTouchStart={longPress ? handlePressStart : undefined}
                onTouchEnd={longPress ? handlePressEnd : undefined}
                onTouchCancel={longPress ? handlePressCancel : undefined}
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

                <div className="relative z-10 flex items-center gap-2">
                    {loading && <Loading />}
                    {iconPosition === 'left' && renderIcon()}
                    {displayText}
                    {iconPosition === 'right' && renderIcon()}
                </div>
            </button>
        )
    }
)

Button.displayName = 'Button'

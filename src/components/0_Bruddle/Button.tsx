import { PEANUTMAN_LOGO } from '@/assets'
import React, { forwardRef, useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

export type ButtonVariant =
    | 'purple'
    | 'dark'
    | 'stroke'
    | 'transparent-light'
    | 'transparent-dark'
    | 'green'
    | 'yellow'
    | 'transparent'
type ButtonSize = 'small' | 'medium' | 'large' | 'xl' | 'xl-fixed'
type ButtonShape = 'default' | 'square'
type ShadowSize = '4' | '6' | '8'
type ShadowType = 'primary' | 'secondary'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant
    size?: ButtonSize
    shape?: ButtonShape
    shadowSize?: ShadowSize
    shadowType?: ShadowType
    loading?: boolean
}

const buttonVariants: Record<ButtonVariant, string> = {
    purple: 'btn-purple',
    dark: 'btn-dark',
    stroke: 'btn-stroke',
    'transparent-light': 'btn-transparent-light',
    'transparent-dark': 'btn-transparent-dark',
    green: 'bg-green-1',
    yellow: 'bg-secondary-1',
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

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ children, className, loading, ...props }, ref) => {
    const localRef = useRef<HTMLButtonElement>(null)
    const buttonRef = (ref as React.RefObject<HTMLButtonElement>) || localRef

    useEffect(() => {
        if (!buttonRef.current) return
        buttonRef.current.setAttribute('translate', 'no')
        buttonRef.current.classList.add('notranslate')
    }, [])

    const buttonClasses = twMerge(
        'btn w-full flex items-center gap-2 transform transition-transform active:scale-90 ease-in-out notranslate',
        buttonVariants[props.variant || 'purple'],
        props.variant === 'transparent' && props.disabled && 'disabled:bg-transparent disabled:border-transparent',
        props.size && buttonSizes[props.size],
        props.shape === 'square' && 'btn-square',
        props.shadowSize && buttonShadows[props.shadowType || 'primary'][props.shadowSize],
        className
    )

    return (
        <button className={twMerge(buttonClasses, 'notranslate')} ref={buttonRef} translate="no" {...props}>
            {loading && (
                <span className="animate-spin">
                    <img src={PEANUTMAN_LOGO.src} alt="logo" className="h-4" />
                </span>
            )}

            {children}
        </button>
    )
})

Button.displayName = 'Button'

import React, { forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'

export type ButtonVariant = 'purple' | 'dark' | 'stroke' | 'transparent-light' | 'transparent-dark' | 'green' | 'yellow'
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
            variant = 'purple',
            size,
            shape = 'default',
            shadowSize,
            shadowType = 'primary',
            loading,
            ...props
        },
        ref
    ) => {
        const buttonClasses = twMerge(
            'btn w-full flex items-center gap-2',
            buttonVariants[variant],
            size && buttonSizes[size],
            shape === 'square' && 'btn-square',
            shadowSize && buttonShadows[shadowType][shadowSize],
            className
        )

        return (
            <button className={buttonClasses} ref={ref} {...props}>
                {loading && <span className="animate-spin">🥜</span>}
                {children}
            </button>
        )
    }
)

Button.displayName = 'Button'

import React, { forwardRef, useEffect, useRef } from 'react'
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
            ...props
        },
        ref
    ) => {
        const localRef = useRef<HTMLButtonElement>(null)
        const buttonRef = (ref as React.RefObject<HTMLButtonElement>) || localRef

        useEffect(() => {
            if (!buttonRef.current) return
            buttonRef.current.setAttribute('translate', 'no')
            buttonRef.current.classList.add('notranslate')
        }, [])

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

        return (
            <button className={twMerge(buttonClasses, 'notranslate')} ref={buttonRef} translate="no" {...props}>
                {loading && <Loading />}
                {iconPosition === 'left' && renderIcon()}
                {children}
                {iconPosition === 'right' && renderIcon()}
            </button>
        )
    }
)

Button.displayName = 'Button'

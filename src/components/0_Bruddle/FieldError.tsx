import React from 'react'
import { twMerge } from '@/utils/tw'

interface FieldErrorProps {
    children?: React.ReactNode
    className?: string
    'data-testid'?: string
}

/**
 * Inline field-level error from the form-field board (17788:19179): Body/XS
 * in foreground-error, sitting 4px under its input where the helper line
 * would be. Field validation only — page/flow-level failures (API errors,
 * submission failures) keep <Notification priority="error">.
 */
export const FieldError = ({ children, className, ...props }: FieldErrorProps) => {
    if (!children) return null
    return (
        <p role="alert" className={twMerge('text-body-xs text-foreground-error', className)} {...props}>
            {children}
        </p>
    )
}

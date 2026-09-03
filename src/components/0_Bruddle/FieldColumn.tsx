import React from 'react'
import { twMerge } from '@/utils/tw'
import { FieldError } from './FieldError'

interface FieldColumnProps {
    children: React.ReactNode
    /** field-level validation message — rendered as a FieldError under the input */
    error?: string | null
    className?: string
    /** test hook carried by the FieldError (e.g. "error-alert" in the payment flows) */
    errorTestId?: string
}

/**
 * The form-field column from the form-field board (17788:19179): an input and
 * its FieldError stacked 4px apart. Compose this instead of respelling the
 * flex/gap utilities at every call site. Field validation only — page/flow
 * failures (API errors, submission failures) stay <Notification priority="error">.
 */
export const FieldColumn = ({ children, error, className, errorTestId }: FieldColumnProps) => (
    <div className={twMerge('flex flex-col gap-1', className)}>
        {children}
        {error ? <FieldError data-testid={errorTestId}>{error}</FieldError> : null}
    </div>
)

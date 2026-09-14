import { type HTMLAttributes, type ReactNode, useId } from 'react'
import { twMerge } from '@/utils/tw'
import { FieldError } from '@/components/0_Bruddle/FieldError'

interface FieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
    /** Field label, Label/L per the form-field board. Omit for label-less fields (rare). */
    label?: ReactNode
    /** id of the labelled control. When the control cannot carry an id (e.g. a radix trigger button), omit it — the label then has no htmlFor and the control needs an aria-label. */
    htmlFor?: string
    /** Helper line under the control, Body/XS secondary. Replaced by the error when one is set — never both (board rule). */
    helper?: ReactNode
    /** Field-level validation error. Red text only — never an input border (TASK-21454 DS call). */
    error?: ReactNode
    /** The control: BaseInput, BaseSelect, or any single form control. */
    children: ReactNode
}

/**
 * Form-field chrome from the form board (figma `17802:61539`): label + control
 * + one helper/error line in a single column. The error is text only
 * (`FieldError`) and replaces the helper — Field never paints error borders on
 * its control. Flow-level failures stay `Notification priority="error"` (see
 * design.md "error display").
 *
 * react-hook-form is the expected state owner: wrap the control in a
 * `Controller` (reference: `AddWithdraw/DynamicBankAccountForm`) and pass
 * `fieldState.error?.message` as `error`.
 */
const Field = ({ label, htmlFor, helper, error, className, children, ...props }: FieldProps) => {
    const errorId = useId()
    return (
        <div className={twMerge('flex w-full flex-col gap-1', className)} {...props}>
            {label && (
                <label htmlFor={htmlFor} className="text-label-l text-foreground-primary">
                    {label}
                </label>
            )}
            {children}
            {error ? (
                <FieldError data-testid={`${htmlFor ?? errorId}-error`}>{error}</FieldError>
            ) : (
                helper && <p className="text-body-xs text-foreground-secondary">{helper}</p>
            )}
        </div>
    )
}

export { Field }

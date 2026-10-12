import { type HTMLAttributes, type ReactNode } from 'react'
import { twMerge } from '@/utils/tw'
import { FieldError } from '@/components/0_Bruddle/FieldError'

interface FieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
    /** Field label, Label/L per the form-field board. Omit for a bare control + error column. */
    label?: ReactNode
    /** id of the labelled control. When the control cannot carry an id (e.g. a radix trigger button), omit it — the label then has no htmlFor and the control needs an aria-label. */
    htmlFor?: string
    /** Helper line under the control, Body/XS secondary. Replaced by the error when one is set — never both (board rule). */
    helper?: ReactNode
    /** Field-level validation error. Red text only — never an input border (TASK-21454 DS call). */
    error?: ReactNode
    /** id on the error line, for the control's `aria-describedby`. */
    errorId?: string
    /** test hook on the error line (e.g. "error-alert" in the payment flows). Defaults to `${htmlFor}-error`. */
    errorTestId?: string
    /** The control: BaseInput, BaseSelect, or any single form control. */
    children: ReactNode
}

/**
 * Form-field chrome from the form board (figma `17802:61539`): an optional
 * label, the control, and one helper/error line in a single column. The error
 * is text only (`FieldError`) and replaces the helper — Field never paints
 * error borders on its control. Flow-level failures stay
 * `Callout priority="error"` (see design.md "error display").
 *
 * Pass no label and no helper to get the bare control + error column. That
 * shape used to be a second component, `FieldColumn`; the fold ruling (kush
 * 2026-09-22, closing the open conflict) made Field the one form-field
 * component.
 *
 * react-hook-form is the expected state owner: wrap the control in a
 * `Controller` (reference: `AddWithdraw/DynamicBankAccountForm`) and pass
 * `fieldState.error?.message` as `error`.
 */
const Field = ({ label, htmlFor, helper, error, errorId, errorTestId, className, children, ...props }: FieldProps) => (
    <div className={twMerge('flex w-full flex-col gap-1', className)} {...props}>
        {label && (
            <label htmlFor={htmlFor} className="text-label-l text-foreground-primary">
                {label}
            </label>
        )}
        {children}
        {error ? (
            <FieldError id={errorId} data-testid={errorTestId ?? (htmlFor ? `${htmlFor}-error` : undefined)}>
                {error}
            </FieldError>
        ) : (
            helper && <p className="text-body-xs text-foreground-secondary">{helper}</p>
        )}
    </div>
)

export { Field }

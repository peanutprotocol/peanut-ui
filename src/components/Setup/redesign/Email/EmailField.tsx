'use client'

import { forwardRef, useId, useState } from 'react'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Icon } from '@/components/Global/Icons/Icon'
import type { EmailMode } from './useEmailStep'

type EmailFieldProps = {
    label: string
    placeholder: string
    clearLabel: string
    value: string
    mode: EmailMode
    valid: boolean
    disabled: boolean
    /** The line under the field: an error (`role="alert"` while present) or, with `status`, a note (`role="status"`). */
    message?: string
    status?: string
    onChange: (value: string) => void
    onBlur: () => void
}

/**
 * The 09 email field (mock `.em-field`): a visible label, the DS input, a trailing slot (green check for a valid
 * address, the error icon for a wrong or used one, a clear button while typing) and a help row that is reserved
 * in every state so the panel never reflows. Only a wrong or used address marks the input (`aria-invalid`); a
 * failed save keeps it neutral with its check.
 */
export const EmailField = forwardRef<HTMLInputElement, EmailFieldProps>(
    ({ label, placeholder, clearLabel, value, mode, valid, disabled, message, status, onChange, onBlur }, ref) => {
        const id = useId()
        const [focused, setFocused] = useState(false)
        const bad = mode === 'invalid' || mode === 'taken'
        const showCheck = valid && !bad
        const showClear = focused && !!value && !valid && mode === 'edit'
        const trailing = bad || showCheck || showClear
        return (
            <div className="flex flex-col">
                <label
                    id={`${id}-label`}
                    htmlFor={id}
                    className="mt-4 mb-1.5 text-label-l text-foreground-primary signup-sm:mt-3"
                >
                    {label}
                </label>
                <div className="relative">
                    <BaseInput
                        ref={ref}
                        id={id}
                        type="email"
                        name="email"
                        autoComplete="email"
                        inputMode="email"
                        autoCapitalize="off"
                        spellCheck={false}
                        maxLength={254}
                        value={value}
                        placeholder={placeholder}
                        disabled={disabled}
                        aria-labelledby={`${id}-label`}
                        aria-invalid={bad ? true : undefined}
                        aria-describedby={`${id}-msg`}
                        className={trailing ? 'pr-12' : undefined}
                        onChange={(event) => onChange(event.target.value)}
                        onFocus={() => setFocused(true)}
                        onBlur={() => {
                            setFocused(false)
                            onBlur()
                        }}
                    />
                    <span className="absolute inset-y-0 right-1 flex w-10 items-center justify-center">
                        {showClear && (
                            <button
                                type="button"
                                aria-label={clearLabel}
                                className="flex h-11 w-10 items-center justify-center text-foreground-primary"
                                // keep the focus in the field: a pointerdown would blur it first
                                onPointerDown={(event) => event.preventDefault()}
                                onClick={() => onChange('')}
                            >
                                <Icon name="cancel" size={20} />
                            </button>
                        )}
                        {showCheck && (
                            <span
                                aria-hidden="true"
                                className="flex size-5 items-center justify-center rounded-full bg-background-icon-bubble-green text-foreground-inverse"
                                data-email-ok
                                data-testid="setup-redesign-email-valid"
                            >
                                <Icon name="check" size={12} strokeWidth={3} />
                            </span>
                        )}
                        {bad && <Icon name="error" size={20} aria-hidden="true" className="text-foreground-error" />}
                    </span>
                </div>
                <div className="mt-1 flex min-h-5 items-center text-body-xs">
                    {status ? (
                        <p id={`${id}-msg`} role="status" className="text-foreground-secondary">
                            {status}
                        </p>
                    ) : (
                        // an alert only while it holds a line: an empty one would be an alert with nothing to say
                        <p id={`${id}-msg`} role={message ? 'alert' : undefined} className="text-foreground-error">
                            {message}
                        </p>
                    )}
                </div>
            </div>
        )
    }
)
EmailField.displayName = 'EmailField'

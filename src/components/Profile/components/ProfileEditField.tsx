import BaseInput from '@/components/0_Bruddle/BaseInput'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import React, { forwardRef, useId } from 'react'
import { FieldColumn } from '@/components/0_Bruddle/FieldColumn'

interface ProfileEditFieldProps {
    label: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
    type?: 'text' | 'email' | 'tel' | 'url'
    badge?: string
    disabled?: boolean
    name?: string
    onBlur?: () => void
    autoComplete?: string
    error?: string
}

/**
 * One labelled field of the profile form. Label sits S (8px) above the input —
 * the "list title ↔ list" step of the spacing anatomy (board 17291:2772). The
 * caller owns the gap between fields, so the rhythm stays 8 < 16 < 24.
 *
 * Chrome comes from the DS input (`.input`): subtle border at rest, black on
 * focus, blue focus ring, `background-disabled` fill when disabled. This file
 * used to re-declare height, padding and a pink focus ring on top, which
 * diverged from the input board (17802:61538).
 */
const ProfileEditField = forwardRef<HTMLInputElement, ProfileEditFieldProps>(
    (
        {
            label,
            value,
            onChange,
            placeholder,
            type = 'text',
            badge,
            disabled = false,
            name,
            onBlur,
            autoComplete,
            error,
        },
        ref
    ) => {
        // dropping the placeholder removed the only accessible name these inputs
        // had, so the label has to be wired to the field properly now
        const id = useId()
        return (
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <label
                        htmlFor={id}
                        className={disabled ? 'text-label-l text-foreground-secondary' : 'text-label-l'}
                    >
                        {label}
                    </label>
                    {badge && <StatusBadge status="soon" size="small" customText={badge} />}
                </div>
                <FieldColumn error={error} errorId={`${id}-error`}>
                    <BaseInput
                        ref={ref}
                        name={name}
                        onBlur={onBlur}
                        autoComplete={autoComplete}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? `${id}-error` : undefined}
                        id={id}
                        variant="sm"
                        type={type}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        disabled={disabled}
                    />
                </FieldColumn>
            </div>
        )
    }
)
ProfileEditField.displayName = 'ProfileEditField'

export default ProfileEditField

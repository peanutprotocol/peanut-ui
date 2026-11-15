'use client'

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Field } from '@/components/0_Bruddle/Field'

export function PostalCodeField({
    id,
    label,
    value,
    required,
    error,
    onChange,
    onBlur,
}: {
    id?: string
    label: string
    value: string
    required: boolean
    error: string | null
    onChange: (value: string) => void
    onBlur?: () => void
}) {
    const generatedId = useId()
    const inputId = id ?? generatedId
    const t = useTranslations('kyc.paperworkVerification')

    return (
        <Field label={label} htmlFor={inputId} error={error} errorId={`${inputId}-error`}>
            <BaseInput
                id={inputId}
                name="postCode"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onBlur={onBlur}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${inputId}-error` : undefined}
                aria-required={required || undefined}
                autoComplete="postal-code"
                autoCapitalize="characters"
                enterKeyHint="next"
                maxLength={100}
                placeholder={required ? undefined : t('optional')}
                className={required ? undefined : 'text-ellipsis'}
                data-testid="verify-input-postCode"
            />
        </Field>
    )
}

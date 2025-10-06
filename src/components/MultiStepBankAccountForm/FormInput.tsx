import React from 'react'
import { Control, Controller, FieldErrors, FieldValues, Path, PathValue } from 'react-hook-form'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { IBankAccountDetails } from './types'

interface FormInputProps {
    name: keyof IBankAccountDetails
    placeholder: string
    rules: any
    control: Control<IBankAccountDetails>
    errors: FieldErrors<IBankAccountDetails>
    touchedFields: Partial<Record<keyof IBankAccountDetails, boolean>>
    type?: string
    onBlur?: (field: any) => Promise<void> | void
}

const FormInput: React.FC<FormInputProps> = ({
    name,
    placeholder,
    rules,
    control,
    errors,
    touchedFields,
    type = 'text',
    onBlur,
}) => {
    return (
        <div className="w-full">
            <div className="relative">
                <Controller
                    name={name}
                    control={control}
                    rules={rules}
                    render={({ field }) => (
                        <BaseInput
                            {...field}
                            type={type}
                            placeholder={placeholder}
                            className="h-12 w-full rounded-sm border border-n-1 bg-white px-4 text-sm"
                            onBlur={async (e) => {
                                // remove any whitespace from the input field
                                if (typeof field.value === 'string') {
                                    field.onChange(field.value.trim())
                                }
                                field.onBlur()
                                if (onBlur) {
                                    await onBlur(field)
                                }
                            }}
                        />
                    )}
                />
            </div>
            <div className="mt-2 w-fit text-start">
                {errors[name] && touchedFields[name] && <ErrorAlert description={errors[name]?.message ?? ''} />}
            </div>
        </div>
    )
}

export default FormInput

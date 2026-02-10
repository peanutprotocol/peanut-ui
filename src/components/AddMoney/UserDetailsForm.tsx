'use client'
import { forwardRef, useEffect, useImperativeHandle } from 'react'
import { useForm, Controller } from 'react-hook-form'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import ErrorAlert from '@/components/Global/ErrorAlert'

export type UserDetailsFormData = {
    fullName: string
    email: string
}

interface UserDetailsFormProps {
    onSubmit: (data: UserDetailsFormData) => Promise<{ error?: string }>
    isSubmitting: boolean
    onValidChange?: (isValid: boolean) => void
    initialData?: Partial<UserDetailsFormData>
}

export const UserDetailsForm = forwardRef<{ handleSubmit: () => void }, UserDetailsFormProps>(
    ({ onSubmit, onValidChange, initialData }, ref) => {
        const {
            control,
            handleSubmit,
            formState: { errors, isValid },
        } = useForm<UserDetailsFormData>({
            defaultValues: {
                fullName: initialData?.fullName ?? '',
                email: initialData?.email ?? '',
            },
            mode: 'all',
        })

        useEffect(() => {
            onValidChange?.(isValid)
        }, [isValid, onValidChange])

        // Note: Submission errors are handled by the parent component
        useImperativeHandle(ref, () => ({
            handleSubmit: handleSubmit(async (data) => {
                await onSubmit(data)
            }),
        }))

        const renderInput = (
            name: keyof UserDetailsFormData,
            placeholder: string,
            rules: any,
            type: string = 'text'
        ) => {
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
                                />
                            )}
                        />
                    </div>
                    <div className="mt-2 w-fit text-start">
                        {errors[name] && <ErrorAlert description={errors[name]?.message ?? ''} />}
                    </div>
                </div>
            )
        }
        return (
            <div className="my-auto flex w-full flex-col justify-center space-y-4">
                <div className="space-y-4">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault()
                        }}
                        className="space-y-4"
                    >
                        <div className="w-full space-y-4">
                            {renderInput('fullName', 'Full Name', { required: 'Full name is required' })}
                            {renderInput('email', 'E-mail', {
                                required: 'Email is required',
                                pattern: {
                                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                    message: 'Invalid email address',
                                },
                            })}
                        </div>
                    </form>
                </div>
            </div>
        )
    }
)

UserDetailsForm.displayName = 'UserDetailsForm'

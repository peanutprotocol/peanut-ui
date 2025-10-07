import React from 'react'
import { Control, FieldErrors } from 'react-hook-form'
import FormInput from '../FormInput'
import { IBankAccountDetails } from '../types'
import { IUserProfile } from '@/interfaces/interfaces'
interface PersonalInfoStepProps {
    control: Control<IBankAccountDetails>
    errors: FieldErrors<IBankAccountDetails>
    touchedFields: Partial<Record<keyof IBankAccountDetails, boolean>>
    flow: 'claim' | 'withdraw'
    user: IUserProfile | null
    hideEmailInput: boolean
}

const PersonalInfoStep: React.FC<PersonalInfoStepProps> = ({
    control,
    errors,
    touchedFields,
    flow,
    user,
    hideEmailInput,
}) => {
    const shouldShowEmailField =
        (flow === 'claim' && user?.user?.userId && !user?.user?.email && !hideEmailInput) ||
        (flow !== 'claim' && !hideEmailInput && !user?.user?.email)

    return (
        <div className="space-y-4">
            <div className="w-full space-y-4">
                <FormInput
                    name="firstName"
                    placeholder="First Name"
                    rules={{ required: 'First name is required' }}
                    control={control}
                    errors={errors}
                    touchedFields={touchedFields}
                />
                <FormInput
                    name="lastName"
                    placeholder="Last Name"
                    rules={{ required: 'Last name is required' }}
                    control={control}
                    errors={errors}
                    touchedFields={touchedFields}
                />
            </div>
            {shouldShowEmailField && (
                <FormInput
                    name="email"
                    placeholder="E-mail"
                    rules={{ required: 'Email is required' }}
                    control={control}
                    errors={errors}
                    touchedFields={touchedFields}
                />
            )}
        </div>
    )
}

export default PersonalInfoStep

import React from 'react'
import { Control, FieldErrors } from 'react-hook-form'
import FormInput from '../FormInput'
import { IBankAccountDetails } from '../types'

interface AddressStepProps {
    control: Control<IBankAccountDetails>
    errors: FieldErrors<IBankAccountDetails>
    touchedFields: Partial<Record<keyof IBankAccountDetails, boolean>>
}

const AddressStep: React.FC<AddressStepProps> = ({ control, errors, touchedFields }) => {
    return (
        <div className="space-y-4">
            <FormInput
                name="street"
                placeholder="Your Street Address"
                rules={{ required: 'Street address is required' }}
                control={control}
                errors={errors}
                touchedFields={touchedFields}
            />
            <FormInput
                name="city"
                placeholder="Your City"
                rules={{ required: 'City is required' }}
                control={control}
                errors={errors}
                touchedFields={touchedFields}
            />
            <FormInput
                name="state"
                placeholder="Your State"
                rules={{ required: 'State is required' }}
                control={control}
                errors={errors}
                touchedFields={touchedFields}
            />
            <FormInput
                name="postalCode"
                placeholder="Your Postal Code"
                rules={{ required: 'Postal code is required' }}
                control={control}
                errors={errors}
                touchedFields={touchedFields}
            />
        </div>
    )
}

export default AddressStep

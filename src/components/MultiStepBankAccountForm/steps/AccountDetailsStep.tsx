import React from 'react'
import { Control, FieldErrors, FieldValues } from 'react-hook-form'
import { validateIban, validateBic, isValidRoutingNumber } from '@/utils/bridge-accounts.utils'
import { getBicFromIban } from '@/app/actions/ibanToBic'
import { getCountryFromIban, validateMXCLabeAccount, validateUSBankAccount } from '@/utils/withdraw.utils'
import FormInput from '../FormInput'
import { IBankAccountDetails, AccountType } from '../types'

interface AccountDetailsStepProps {
    control: Control<IBankAccountDetails>
    errors: FieldErrors<IBankAccountDetails>
    touchedFields: Partial<Record<keyof IBankAccountDetails, boolean>>
    accountType: AccountType
    selectedCountry: string
    setValue: (name: keyof IBankAccountDetails, value: any, options?: any) => void
    getValues: (name?: keyof IBankAccountDetails) => any
    debouncedBicValue: string
    setisCheckingBICValid: (value: boolean) => void
    submissionError: string | null
    setSubmissionError: (error: string | null) => void
}

const AccountDetailsStep: React.FC<AccountDetailsStepProps> = ({
    control,
    errors,
    touchedFields,
    accountType,
    selectedCountry,
    setValue,
    getValues,
    debouncedBicValue,
    setisCheckingBICValid,
    submissionError,
    setSubmissionError,
}) => {
    const isMx = accountType === 'MX'
    const isUs = accountType === 'US'
    const isIban = accountType === 'IBAN'

    const renderAccountInput = () => {
        if (isMx) {
            return (
                <FormInput
                    name="clabe"
                    placeholder="CLABE"
                    rules={{
                        required: 'CLABE is required',
                        minLength: { value: 18, message: 'CLABE must be 18 digits' },
                        maxLength: { value: 18, message: 'CLABE must be 18 digits' },
                        validate: async (value: string) => validateMXCLabeAccount(value).isValid || 'Invalid CLABE',
                    }}
                    control={control}
                    errors={errors}
                    touchedFields={touchedFields}
                />
            )
        }

        if (isIban) {
            return (
                <FormInput
                    name="accountNumber"
                    placeholder="IBAN"
                    rules={{
                        required: 'IBAN is required',
                        validate: async (val: string) => {
                            const isValidIban = await validateIban(val)
                            if (!isValidIban) return 'Invalid IBAN'

                            if (getCountryFromIban(val)?.toLowerCase() !== selectedCountry) {
                                return 'IBAN does not match the selected country'
                            }

                            return true
                        },
                    }}
                    control={control}
                    errors={errors}
                    touchedFields={touchedFields}
                    onBlur={async (field) => {
                        if (!field.value || field.value.trim().length === 0) return
                        const isValidIban = await validateIban(field.value)
                        if (isValidIban) {
                            try {
                                const autoBic = await getBicFromIban(field.value)
                                if (autoBic && !getValues('bic')) {
                                    setValue('bic', autoBic, { shouldValidate: true })
                                }
                            } catch {
                                console.log('Could not fetch BIC automatically.')
                            }
                        }
                    }}
                />
            )
        }

        // US account
        return (
            <FormInput
                name="accountNumber"
                placeholder="Account Number"
                rules={{
                    required: 'Account number is required',
                    validate: async (value: string) => validateUSBankAccount(value).isValid || 'Invalid account number',
                }}
                control={control}
                errors={errors}
                touchedFields={touchedFields}
            />
        )
    }

    return (
        <div className="space-y-4">
            {renderAccountInput()}

            {isIban && (
                <FormInput
                    name="bic"
                    placeholder="BIC"
                    rules={{
                        required: 'BIC is required',
                        validate: async (value: string) => {
                            if (!value || value.trim().length === 0) return 'BIC is required'

                            // Only validate if the value matches the debounced value (to prevent API calls on every keystroke)
                            if (value.trim() !== debouncedBicValue?.trim()) {
                                return true // Skip validation until debounced value is ready
                            }

                            setisCheckingBICValid(true)
                            const isValid = await validateBic(value.trim())
                            setisCheckingBICValid(false)
                            return isValid || 'Invalid BIC code'
                        },
                    }}
                    control={control}
                    errors={errors}
                    touchedFields={touchedFields}
                    onBlur={(field) => {
                        if (field.value && field.value.trim().length > 0 && submissionError) {
                            setSubmissionError(null)
                        }
                    }}
                />
            )}

            {isUs && (
                <FormInput
                    name="routingNumber"
                    placeholder="Routing Number"
                    rules={{
                        required: 'Routing number is required',
                        validate: async (value: string) =>
                            (await isValidRoutingNumber(value)) || 'Invalid routing number',
                    }}
                    control={control}
                    errors={errors}
                    touchedFields={touchedFields}
                />
            )}
        </div>
    )
}

export default AccountDetailsStep

import { useState } from 'react'
import { UseFormRegister, UseFormSetValue } from 'react-hook-form'
import { sanitizeBankAccount } from '@/utils/format.utils'

interface IUSBankAccountInputProps {
    register: UseFormRegister<any>
    setValue: UseFormSetValue<any>
    errors: any
    defaultValues?: {
        routingNumber?: string
        accountNumber?: string
    }
}

export const USBankAccountInput = ({ register, setValue, errors, defaultValues }: IUSBankAccountInputProps) => {
    const [showBothFields, setShowBothFields] = useState(!!defaultValues?.routingNumber)

    const handleCombinedInput = (value: string) => {
        const sanitizedValue = sanitizeBankAccount(value)

        if (!/^[0-9]+$/.test(sanitizedValue)) {
            setValue('combinedAccount', '', {
                shouldValidate: true,
            })
            return
        }

        if (sanitizedValue.length >= 9) {
            const routingNumber = sanitizedValue.slice(0, 9)
            const accountNumber = sanitizedValue.slice(9)
            setValue('routingNumber', routingNumber, { shouldValidate: true })
            setValue('accountNumber', accountNumber, { shouldValidate: true })
            setShowBothFields(true)
        }
    }

    if (!showBothFields) {
        return (
            <div className="flex w-full flex-col gap-2">
                <div className="flex flex-col gap-2">
                    <input
                        className={`custom-input ${errors.combinedAccount ? 'border border-red' : ''}`}
                        placeholder="Enter your routing number"
                        onChange={(e) => handleCombinedInput(e.target.value)}
                    />
                    <span className="text-h9 font-light">
                        Enter your 9-digit routing number. You can find this at the bottom of your checks or in your
                        bank's online portal.
                    </span>
                    {errors.combinedAccount && (
                        <span className="text-h9 font-normal text-red">{errors.combinedAccount.message}</span>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="flex w-full flex-col gap-2">
            <div className="flex flex-col gap-2">
                <input
                    {...register('routingNumber', {
                        required: 'Routing number is required',
                        pattern: {
                            value: /^[0-9]{9}$/,
                            message: 'Routing number must be 9 digits',
                        },
                        setValueAs: (value: string) => sanitizeBankAccount(value),
                    })}
                    className={`custom-input ${errors.routingNumber ? 'border border-red' : ''}`}
                    placeholder="Routing number (9 digits)"
                />
                <span className="text-h9 font-light">
                    Routing number (9 digits): Found at the bottom of your checks or in your bank's online portal
                </span>
                {errors.routingNumber && (
                    <span className="text-h9 font-normal text-red">{errors.routingNumber.message}</span>
                )}
            </div>
            <div className="flex flex-col gap-2">
                <input
                    {...register('accountNumber', {
                        required: 'Account number is required',
                        pattern: {
                            value: /^[0-9]{1,17}$/,
                            message: 'Please enter a valid account number',
                        },
                        setValueAs: (value: string) => sanitizeBankAccount(value),
                    })}
                    className={`custom-input ${errors.accountNumber ? 'border border-red' : ''}`}
                    placeholder="Account number"
                />
                <span className="text-h9 font-light">Your account number, typically 10-12 digits</span>
                {errors.accountNumber && (
                    <span className="text-h9 font-normal text-red">{errors.accountNumber.message}</span>
                )}
            </div>
            <button
                type="button"
                className="text-h9 text-gray-1 underline"
                onClick={() => {
                    setValue('routingNumber', '')
                    setValue('accountNumber', '')
                    setShowBothFields(false)
                }}
            >
                Re-enter account details
            </button>
        </div>
    )
}

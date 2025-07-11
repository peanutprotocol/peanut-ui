'use client'
import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useAuth } from '@/context/authContext'
import { Button } from '@/components/0_Bruddle/Button'
import { AddBankAccountPayload, BridgeAccountOwnerType, BridgeAccountType } from '@/app/actions/types/users.types'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { countryCodeMap } from '@/components/AddMoney/consts'
import { useParams } from 'next/navigation'
import { validateBankAccount, validateIban, validateBic, isValidRoutingNumber } from '@/utils/bridge-accounts.utils'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { getBicFromIban } from '@/app/actions/ibanToBic'
import PeanutActionDetailsCard from '../Global/PeanutActionDetailsCard'
import { PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants'
import { useWithdrawFlow } from '@/context/WithdrawFlowContext'

const isIBANCountry = (country: string) => {
    return countryCodeMap[country.toUpperCase()] !== undefined
}

export type FormData = {
    firstName: string
    lastName: string
    email: string
    accountNumber: string
    bic: string
    routingNumber: string
    clabe: string
    street: string
    city: string
    state: string
    postalCode: string
}

interface DynamicBankAccountFormProps {
    country: string
    onSuccess: (payload: AddBankAccountPayload, rawData: FormData) => Promise<{ error?: string }>
    initialData?: Partial<FormData>
}

export const DynamicBankAccountForm = forwardRef<{ handleSubmit: () => void }, DynamicBankAccountFormProps>(
    ({ country, onSuccess, initialData }, ref) => {
        const { user } = useAuth()
        const [isSubmitting, setIsSubmitting] = useState(false)
        const [submissionError, setSubmissionError] = useState<string | null>(null)
        const { country: countryName } = useParams()
        const { amountToWithdraw } = useWithdrawFlow()
        const [firstName, ...lastNameParts] = (user?.user.fullName ?? '').split(' ')
        const lastName = lastNameParts.join(' ')

        const {
            control,
            handleSubmit,
            setValue,
            formState: { errors, isValid, isValidating, touchedFields },
        } = useForm<FormData>({
            defaultValues: {
                firstName: firstName ?? '',
                lastName: lastName ?? '',
                email: user?.user.email ?? '',
                accountNumber: '',
                bic: '',
                routingNumber: '',
                clabe: '',
                street: '',
                city: '',
                state: '',
                postalCode: '',
                ...initialData,
            },
            mode: 'onBlur',
        })

        useImperativeHandle(ref, () => ({
            handleSubmit: handleSubmit(onSubmit),
        }))

        const onSubmit = async (data: FormData) => {
            setIsSubmitting(true)
            setSubmissionError(null)
            try {
                const isIban = isIBANCountry(country)
                const isUs = country.toUpperCase() === 'US'
                const isMx = country.toUpperCase() === 'MX'

                let accountType: BridgeAccountType
                if (isIban) accountType = BridgeAccountType.IBAN
                else if (isUs) accountType = BridgeAccountType.US
                else if (isMx) accountType = BridgeAccountType.CLABE
                else throw new Error('Unsupported country')

                const accountNumber = isMx ? data.clabe : data.accountNumber

                const { firstName, lastName } = data

                const payload: Partial<AddBankAccountPayload> = {
                    accountType,
                    accountNumber: accountNumber.replace(/\s/g, ''),
                    countryCode: isUs ? 'USA' : country.toUpperCase(),
                    countryName: countryName as string,
                    accountOwnerType: BridgeAccountOwnerType.INDIVIDUAL,
                    accountOwnerName: {
                        firstName: firstName.trim(),
                        lastName: lastName.trim(),
                    },
                    address: {
                        street: data.street ?? '',
                        city: data.city ?? '',
                        state: data.state ?? '',
                        postalCode: data.postalCode ?? '',
                        country: isUs ? 'USA' : country.toUpperCase(),
                    },
                    ...(data.bic && { bic: data.bic }),
                }

                if (isUs && data.routingNumber) {
                    payload.routingNumber = data.routingNumber
                }

                const result = await onSuccess(payload as AddBankAccountPayload, {
                    ...data,
                    firstName: data.firstName.trim(),
                    lastName: data.lastName.trim(),
                })
                if (result.error) {
                    setSubmissionError(result.error)
                }
            } catch (error: any) {
                setSubmissionError(error.message)
            } finally {
                setIsSubmitting(false)
            }
        }

        const isIban = isIBANCountry(country)
        const isUs = country.toUpperCase() === 'US'
        const isMx = country.toUpperCase() === 'MX'

        const renderInput = (
            name: keyof FormData,
            placeholder: string,
            rules: any,
            type: string = 'text',
            rightAdornment?: React.ReactNode,
            onBlur?: (field: any) => Promise<void> | void
        ) => (
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

        const countryCodeForFlag = useMemo(() => {
            return countryCodeMap[country.toUpperCase()] ?? country.toUpperCase()
        }, [country])

        return (
            <div className="my-auto flex h-full min-h-[inherit] w-full flex-col justify-center space-y-4 pb-5">
                <PeanutActionDetailsCard
                    countryCodeForFlag={countryCodeForFlag.toLowerCase()}
                    avatarSize="small"
                    transactionType={'WITHDRAW_BANK_ACCOUNT'}
                    recipientType={'BANK_ACCOUNT'}
                    recipientName={country}
                    amount={amountToWithdraw}
                    tokenSymbol={PEANUT_WALLET_TOKEN_SYMBOL}
                />

                <div className="space-y-4">
                    <h3 className="text-base font-bold">Enter bank account details</h3>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault()
                            handleSubmit(onSubmit)()
                        }}
                        className="space-y-4"
                    >
                        {!user?.user?.fullName && (
                            <div className="w-full space-y-4">
                                {renderInput('firstName', 'First Name', { required: 'First name is required' })}
                                {renderInput('lastName', 'Last Name', { required: 'Last name is required' })}
                            </div>
                        )}
                        {!user?.user?.email &&
                            renderInput('email', 'E-mail', {
                                required: 'Email is required',
                            })}

                        {isMx
                            ? renderInput('clabe', 'CLABE', {
                                  required: 'CLABE is required',
                                  minLength: { value: 18, message: 'CLABE must be 18 digits' },
                                  maxLength: { value: 18, message: 'CLABE must be 18 digits' },
                              })
                            : isIban
                              ? renderInput(
                                    'accountNumber',
                                    'IBAN',
                                    {
                                        required: 'Account number is required',
                                        validate: async (val: string) => (await validateIban(val)) || 'Invalid IBAN',
                                    },
                                    'text',
                                    undefined,
                                    async (field) => {
                                        if (!field.value || field.value.trim().length === 0) return

                                        try {
                                            const bic = await getBicFromIban(field.value.trim())
                                            if (bic) {
                                                setValue('bic', bic, { shouldValidate: true })
                                            }
                                        } catch (error) {
                                            console.warn('Failed to fetch BIC:', error)
                                        }
                                    }
                                )
                              : renderInput(
                                    'accountNumber',
                                    'Account Number',
                                    {
                                        required: 'Account number is required',
                                        validate: async (value: string) =>
                                            (await validateBankAccount(value)) || 'Invalid account number',
                                    },
                                    'text'
                                )}

                        {isIban &&
                            renderInput('bic', 'BIC', {
                                required: 'BIC is required',
                                validate: async (value: string) => (await validateBic(value)) || 'Invalid BIC code',
                            })}
                        {isUs &&
                            renderInput('routingNumber', 'Routing Number', {
                                required: 'Routing number is required',
                                validate: async (value: string) =>
                                    (await isValidRoutingNumber(value)) || 'Invalid routing number',
                            })}

                        {!isIban && (
                            <>
                                {renderInput('street', 'Bank Address', { required: 'Bank address is required' })}

                                {renderInput('city', 'City', { required: 'City is required' })}

                                {renderInput('state', 'State', {
                                    required: 'State is required',
                                })}

                                {renderInput('postalCode', 'Postal Code', {
                                    required: 'Postal code is required',
                                })}
                            </>
                        )}
                        <Button
                            type="submit"
                            variant="purple"
                            shadowSize="4"
                            className="!mt-4 w-full"
                            loading={isSubmitting || isValidating}
                            disabled={isSubmitting || !isValid || isValidating}
                        >
                            Review
                        </Button>
                        {submissionError && <ErrorAlert description={submissionError} />}
                    </form>
                </div>
            </div>
        )
    }
)

DynamicBankAccountForm.displayName = 'DynamicBankAccountForm'

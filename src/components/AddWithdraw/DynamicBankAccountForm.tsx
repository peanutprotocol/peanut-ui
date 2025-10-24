'use client'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useAuth } from '@/context/authContext'
import { Button } from '@/components/0_Bruddle/Button'
import { type AddBankAccountPayload, BridgeAccountOwnerType, BridgeAccountType } from '@/app/actions/types/users.types'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { BRIDGE_ALPHA3_TO_ALPHA2, ALL_COUNTRIES_ALPHA3_TO_ALPHA2 } from '@/components/AddMoney/consts'
import { useParams, useRouter } from 'next/navigation'
import { validateIban, validateBic, isValidRoutingNumber } from '@/utils/bridge-accounts.utils'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { getBicFromIban } from '@/app/actions/ibanToBic'
import PeanutActionDetailsCard, { type PeanutActionDetailsCardProps } from '../Global/PeanutActionDetailsCard'
import { PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants'
import { useWithdrawFlow } from '@/context/WithdrawFlowContext'
import { getCountryFromIban, validateMXCLabeAccount, validateUSBankAccount } from '@/utils/withdraw.utils'
import useSavedAccounts from '@/hooks/useSavedAccounts'
import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { bankFormActions } from '@/redux/slices/bank-form-slice'
import { useDebounce } from '@/hooks/useDebounce'

const isIBANCountry = (country: string) => {
    return BRIDGE_ALPHA3_TO_ALPHA2[country.toUpperCase()] !== undefined
}

export type IBankAccountDetails = {
    name?: string
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
    iban: string
    country: string
}

interface DynamicBankAccountFormProps {
    country: string
    countryName?: string
    onSuccess: (payload: AddBankAccountPayload, rawData: IBankAccountDetails) => Promise<{ error?: string }>
    initialData?: Partial<IBankAccountDetails>
    flow?: 'claim' | 'withdraw'
    actionDetailsProps?: Partial<PeanutActionDetailsCardProps>
    error: string | null
    hideEmailInput?: boolean
}

export const DynamicBankAccountForm = forwardRef<{ handleSubmit: () => void }, DynamicBankAccountFormProps>(
    (
        {
            country,
            onSuccess,
            initialData,
            flow = 'withdraw',
            actionDetailsProps,
            countryName: countryNameFromProps,
            error,
            hideEmailInput = false,
        },
        ref
    ) => {
        const isMx = country.toUpperCase() === 'MX'
        const isUs = country.toUpperCase() === 'USA'
        const isIban = isUs || isMx ? false : isIBANCountry(country)
        const { user } = useAuth()
        const dispatch = useAppDispatch()
        const [isSubmitting, setIsSubmitting] = useState(false)
        const [submissionError, setSubmissionError] = useState<string | null>(null)
        const { country: countryNameParams } = useParams()
        const { amountToWithdraw, setSelectedBankAccount } = useWithdrawFlow()
        const [firstName, ...lastNameParts] = (user?.user.fullName ?? '').split(' ')
        const lastName = lastNameParts.join(' ')
        const router = useRouter()
        const savedAccounts = useSavedAccounts()
        const [isCheckingBICValid, setisCheckingBICValid] = useState(false)

        let selectedCountry = (countryNameFromProps ?? (countryNameParams as string)).toLowerCase()

        // Get persisted form data from Redux
        const persistedFormData = useAppSelector((state) => state.bankForm.formData)

        const {
            control,
            handleSubmit,
            setValue,
            getValues,
            watch,
            formState: { errors, isValid, isValidating, touchedFields },
        } = useForm<IBankAccountDetails>({
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
                ...persistedFormData, // Redux persisted data takes precedence
            },
            mode: 'onBlur',
            reValidateMode: 'onSubmit',
        })

        // Watch BIC field value for debouncing
        const bicValue = watch('bic')
        const debouncedBicValue = useDebounce(bicValue, 500) // 500ms delay

        useImperativeHandle(ref, () => ({
            handleSubmit: handleSubmit(onSubmit),
        }))

        // Trigger BIC validation when debounced value changes
        useEffect(() => {
            if (isIban && debouncedBicValue && debouncedBicValue.trim().length > 0) {
                // Trigger validation for the BIC field
                setValue('bic', debouncedBicValue, { shouldValidate: true })
            }
        }, [debouncedBicValue, isIban, setValue])

        const onSubmit = async (data: IBankAccountDetails) => {
            // If validation is still running, don't proceed
            if (isValidating) {
                console.log('Validation still checking, skipping submission')
                return
            }

            // Clear any existing submission errors before starting
            if (submissionError) {
                setSubmissionError(null)
            }

            setIsSubmitting(true)
            try {
                const existingAccount = savedAccounts.find(
                    (account) => account.identifier === (data.accountNumber.toLowerCase() || data.clabe.toLowerCase())
                )

                // Skip adding account if the account already exists for the logged in user
                if (existingAccount) {
                    setSelectedBankAccount(existingAccount)
                    router.push(`/withdraw/${country}/bank`)
                    return
                }

                const isUs = country.toUpperCase() === 'USA'
                const isMx = country.toUpperCase() === 'MX'
                const isIban = isUs || isMx ? false : isIBANCountry(country)

                let accountType: BridgeAccountType
                if (isIban) accountType = BridgeAccountType.IBAN
                else if (isUs) accountType = BridgeAccountType.US
                else if (isMx) accountType = BridgeAccountType.CLABE
                else throw new Error('Unsupported country')

                const accountNumber = isMx ? data.clabe : data.accountNumber

                const { firstName, lastName } = data
                let bic = data.bic || getValues('bic')
                const iban = data.iban || getValues('iban')

                const payload: Partial<AddBankAccountPayload> = {
                    accountType,
                    accountNumber: accountNumber.replace(/\s/g, ''),
                    countryCode: isUs ? 'USA' : country.toUpperCase(),
                    countryName: selectedCountry,
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
                    ...(bic && { bic }),
                }

                if (isUs && data.routingNumber) {
                    payload.routingNumber = data.routingNumber
                }

                const result = await onSuccess(payload as AddBankAccountPayload, {
                    ...data,
                    iban: isIban ? data.accountNumber || iban || '' : '',
                    accountNumber: isIban ? '' : data.accountNumber,
                    bic: bic,
                    country,
                    firstName: data.firstName.trim(),
                    lastName: data.lastName.trim(),
                    name: data.name,
                })
                if (result.error) {
                    setSubmissionError(result.error)
                    setIsSubmitting(false)
                } else {
                    // Save form data to Redux after successful submission
                    const formDataToSave = {
                        ...data,
                        country,
                        firstName: data.firstName.trim(),
                        lastName: data.lastName.trim(),
                    }
                    dispatch(bankFormActions.setFormData(formDataToSave))
                    setIsSubmitting(false)
                }
            } catch (error: any) {
                setSubmissionError(error.message)
            } finally {
                setIsSubmitting(false)
            }
        }

        const renderInput = (
            name: keyof IBankAccountDetails,
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
                                    // remove any whitespace from the input field
                                    // note: @dev not a great fix, this should also be fixed in the backend
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

        const countryCodeForFlag = useMemo(() => {
            return ALL_COUNTRIES_ALPHA3_TO_ALPHA2[country.toUpperCase()] ?? country.toUpperCase()
        }, [country])

        return (
            <div className="my-auto flex h-full w-full flex-col justify-center space-y-4 pb-5">
                <PeanutActionDetailsCard
                    countryCodeForFlag={countryCodeForFlag.toLowerCase()}
                    avatarSize="small"
                    transactionType={'WITHDRAW_BANK_ACCOUNT'}
                    recipientType={'BANK_ACCOUNT'}
                    recipientName={country}
                    amount={amountToWithdraw}
                    tokenSymbol={PEANUT_WALLET_TOKEN_SYMBOL}
                    {...actionDetailsProps}
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
                        {flow === 'claim' && !user?.user.userId && (
                            <div className="w-full space-y-4">
                                {renderInput('firstName', 'First Name', { required: 'First name is required' })}
                                {renderInput('lastName', 'Last Name', { required: 'Last name is required' })}
                            </div>
                        )}
                        {flow === 'claim' && user?.user.userId && !user.user.fullName && (
                            <div className="w-full space-y-4">
                                {renderInput('firstName', 'First Name', { required: 'First name is required' })}
                                {renderInput('lastName', 'Last Name', { required: 'Last name is required' })}
                            </div>
                        )}
                        {flow === 'claim' &&
                            user?.user.userId &&
                            !user.user.email &&
                            !hideEmailInput &&
                            renderInput('email', 'E-mail', {
                                required: 'Email is required',
                            })}
                        {flow !== 'claim' && !user?.user?.fullName && (
                            <div className="w-full space-y-4">
                                {renderInput('firstName', 'First Name', { required: 'First name is required' })}
                                {renderInput('lastName', 'Last Name', { required: 'Last name is required' })}
                            </div>
                        )}
                        {flow !== 'claim' &&
                            !hideEmailInput &&
                            !user?.user?.email &&
                            renderInput('email', 'E-mail', {
                                required: 'Email is required',
                            })}

                        {isMx
                            ? renderInput('clabe', 'CLABE', {
                                  required: 'CLABE is required',
                                  minLength: { value: 18, message: 'CLABE must be 18 digits' },
                                  maxLength: { value: 18, message: 'CLABE must be 18 digits' },
                                  validate: async (value: string) =>
                                      validateMXCLabeAccount(value).isValid || 'Invalid CLABE',
                              })
                            : isIban
                              ? renderInput(
                                    'accountNumber',
                                    'IBAN',
                                    {
                                        required: 'IBAN is required',
                                        validate: async (val: string) => {
                                            const isValidIban = await validateIban(val)
                                            if (!isValidIban) return 'Invalid IBAN'

                                            if (getCountryFromIban(val)?.toLowerCase() !== selectedCountry) {
                                                return 'IBAN does not match the selected country'
                                            }

                                            return true
                                        },
                                    },
                                    'text',
                                    undefined,
                                    async (field) => {
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
                                    }
                                )
                              : renderInput(
                                    'accountNumber',
                                    'Account Number',
                                    {
                                        required: 'Account number is required',
                                        validate: async (value: string) =>
                                            validateUSBankAccount(value).isValid || 'Invalid account number',
                                    },
                                    'text'
                                )}

                        {isIban &&
                            renderInput(
                                'bic',
                                'BIC',
                                {
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
                                },
                                'text',
                                undefined,
                                (field) => {
                                    if (field.value && field.value.trim().length > 0 && submissionError) {
                                        setSubmissionError(null)
                                    }
                                }
                            )}
                        {isUs &&
                            renderInput('routingNumber', 'Routing Number', {
                                required: 'Routing number is required',
                                validate: async (value: string) =>
                                    (await isValidRoutingNumber(value)) || 'Invalid routing number',
                            })}

                        {!isIban && (
                            <>
                                {renderInput('street', 'Your Street Address', {
                                    required: 'Street address is required',
                                })}

                                {renderInput('city', 'Your City', { required: 'City is required' })}

                                {renderInput('state', 'Your State', {
                                    required: 'State is required',
                                })}

                                {renderInput('postalCode', 'Your Postal Code', {
                                    required: 'Postal code is required',
                                })}
                            </>
                        )}
                        <Button
                            type="submit"
                            variant="purple"
                            shadowSize="4"
                            className="!mt-4 w-full"
                            loading={isSubmitting || isCheckingBICValid}
                            disabled={isSubmitting || !isValid || isCheckingBICValid}
                        >
                            Review
                        </Button>
                        {submissionError ? (
                            <ErrorAlert description={submissionError} />
                        ) : (
                            error && <ErrorAlert description={error} />
                        )}
                    </form>
                </div>
            </div>
        )
    }
)

DynamicBankAccountForm.displayName = 'DynamicBankAccountForm'

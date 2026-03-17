'use client'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useAuth } from '@/context/authContext'
import { Button } from '@/components/0_Bruddle/Button'
import { type AddBankAccountPayload, BridgeAccountOwnerType, BridgeAccountType } from '@/app/actions/types/users.types'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import BaseSelect from '@/components/0_Bruddle/BaseSelect'
import { BRIDGE_ALPHA3_TO_ALPHA2, ALL_COUNTRIES_ALPHA3_TO_ALPHA2 } from '@/components/AddMoney/consts'
import { useParams, useRouter } from 'next/navigation'
import {
    validateIban,
    validateBic,
    isValidRoutingNumber,
    isValidSortCode,
    isValidUKAccountNumber,
} from '@/utils/bridge-accounts.utils'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { getBicFromIban } from '@/app/actions/ibanToBic'
import PeanutActionDetailsCard, { type PeanutActionDetailsCardProps } from '../Global/PeanutActionDetailsCard'
import { useWithdrawFlow } from '@/context/WithdrawFlowContext'
import { getCountryFromIban, validateMXCLabeAccount, validateUSBankAccount } from '@/utils/withdraw.utils'
import useSavedAccounts from '@/hooks/useSavedAccounts'
import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { bankFormActions } from '@/redux/slices/bank-form-slice'
import { useDebounce } from '@/hooks/useDebounce'
import { twMerge } from 'tailwind-merge'
import { MX_STATES, US_STATES } from '@/constants/stateCodes.consts'
import { PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants/zerodev.consts'

const isIBANCountry = (country: string) => {
    return BRIDGE_ALPHA3_TO_ALPHA2[country.toUpperCase()] !== undefined
}

export type IBankAccountDetails = {
    name?: string
    firstName: string
    lastName: string
    accountOwnerName?: string // single field for withdraw flow
    email: string
    accountNumber: string
    bic: string
    routingNumber: string
    sortCode: string // uk bank accounts
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
        const isUk = country.toUpperCase() === 'GB' || country.toUpperCase() === 'GBR'
        const isIban = isUs || isMx || isUk ? false : isIBANCountry(country)
        const { user } = useAuth()
        const dispatch = useAppDispatch()
        const [isSubmitting, setIsSubmitting] = useState(false)
        const [submissionError, setSubmissionError] = useState<string | null>(null)
        const { country: countryNameParams } = useParams()
        const { amountToWithdraw, setSelectedBankAccount } = useWithdrawFlow()
        const router = useRouter()
        const savedAccounts = useSavedAccounts()
        const [isCheckingBICValid, setisCheckingBICValid] = useState(false)
        const STREET_ADDRESS_MAX_LENGTH = 35 // From bridge docs: street address can be max 35 characters

        let selectedCountry = (countryNameFromProps ?? (countryNameParams as string)).toLowerCase()

        // Get persisted form data from Redux
        const persistedFormData = useAppSelector((state) => state.bankForm.formData)

        // for claim flow: pre-fill accountOwnerName from user if logged in, for withdraw flow: keep empty
        const defaultAccountOwnerName = flow === 'claim' && user?.user.fullName ? user.user.fullName : ''

        const {
            control,
            handleSubmit,
            setValue,
            getValues,
            watch,
            formState: { errors, isValid, isValidating, touchedFields },
        } = useForm<IBankAccountDetails>({
            defaultValues: {
                firstName: '', // kept for backwards compatibility but not used in UI
                lastName: '', // kept for backwards compatibility but not used in UI
                accountOwnerName: defaultAccountOwnerName,
                email: flow === 'claim' ? (user?.user.email ?? '') : '', // only pre-fill email in claim flow
                accountNumber: '',
                bic: '',
                routingNumber: '',
                sortCode: '', // uk bank accounts
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
                const isUk = country.toUpperCase() === 'GB' || country.toUpperCase() === 'GBR'
                const isIban = isUs || isMx || isUk ? false : isIBANCountry(country)

                let accountType: BridgeAccountType
                if (isIban) accountType = BridgeAccountType.IBAN
                else if (isUs) accountType = BridgeAccountType.US
                else if (isMx) accountType = BridgeAccountType.CLABE
                else if (isUk) accountType = BridgeAccountType.GB
                else throw new Error('Unsupported country')

                const accountNumber = isMx ? data.clabe : data.accountNumber

                // split accountOwnerName into first and last name for all flows
                // note: bridge api requires both first_name and last_name for individual accounts,
                // so we validate that accountOwnerName contains at least 2 words in the form
                let firstName: string
                let lastName: string

                if (data.accountOwnerName) {
                    // split the trimmed name into parts using one or more whitespace characters as the separator
                    // this allows to handle cases where the name has multiple parts like "Peanut Guy" or "Happy Peanut Guy"
                    const nameParts = data.accountOwnerName.trim().split(/\s+/)
                    firstName = nameParts[0] || ''
                    lastName = nameParts.slice(1).join(' ') || ''
                } else {
                    // fallback to firstName/lastName if accountOwnerName is not set (backwards compatibility)
                    firstName = data.firstName || ''
                    lastName = data.lastName || ''
                }

                let bic = data.bic || getValues('bic')
                const iban = data.iban || getValues('iban')

                // uk account numbers may be 6-7 digits, pad to 8 for bridge api
                const cleanedAccountNumber = isUk
                    ? accountNumber.replace(/\s/g, '').padStart(8, '0')
                    : accountNumber.replace(/\s/g, '')

                const payload: Partial<AddBankAccountPayload> = {
                    accountType,
                    accountNumber: cleanedAccountNumber,
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

                if (isUk && data.sortCode) {
                    payload.sortCode = data.sortCode.replace(/[-\s]/g, '')
                }

                const result = await onSuccess(payload as AddBankAccountPayload, {
                    ...data,
                    iban: isIban ? data.accountNumber || iban || '' : '',
                    accountNumber: isIban ? '' : data.accountNumber,
                    bic: bic,
                    sortCode: isUk ? data.sortCode : '',
                    country,
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
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
                        firstName: firstName.trim(),
                        lastName: lastName.trim(),
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
            onBlur?: (field: any) => Promise<void> | void,
            showCharCount?: boolean,
            maxLength?: number
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
                                className={twMerge(
                                    'h-12 w-full rounded-sm border border-n-1 bg-white px-4 text-sm',
                                    errors[name] && touchedFields[name] && 'border-error'
                                )}
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
                                rightContent={
                                    showCharCount && maxLength ? (
                                        <span className="text-xs">
                                            {field.value?.length ?? 0}/{maxLength}
                                        </span>
                                    ) : undefined
                                }
                            />
                        )}
                    />
                </div>
                <div className="mt-2 w-fit text-start">
                    {errors[name] && touchedFields[name] && <ErrorAlert description={errors[name]?.message ?? ''} />}
                </div>
            </div>
        )

        const renderSelect = (name: keyof IBankAccountDetails, placeholder: string, options: any[], rules: any) => (
            <div className="w-full">
                <Controller
                    name={name}
                    control={control}
                    rules={rules}
                    render={({ field }) => (
                        <BaseSelect
                            options={options}
                            placeholder={placeholder}
                            value={field.value}
                            onValueChange={field.onChange}
                            onBlur={field.onBlur}
                            error={!!(errors[name] && touchedFields[name])}
                            className={twMerge(
                                'h-12 w-full rounded-sm border border-n-1 bg-white px-4 text-sm',
                                errors[name] && touchedFields[name] && 'border-error'
                            )}
                        />
                    )}
                />
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
                        {/* CLAIM FLOW: show name field for guest users or logged-in users without fullName */}
                        {flow === 'claim' && !user?.user.userId && (
                            <div className="w-full space-y-4">
                                {renderInput('accountOwnerName', 'Account Owner Name', {
                                    required: 'Account owner name is required',
                                    validate: (value: string) => {
                                        const trimmed = value.trim()
                                        const parts = trimmed.split(/\s+/)
                                        if (parts.length < 2) {
                                            return 'Please enter both first and last name'
                                        }
                                        return true
                                    },
                                })}
                            </div>
                        )}
                        {flow === 'claim' && user?.user.userId && !user.user.fullName && (
                            <div className="w-full space-y-4">
                                {renderInput('accountOwnerName', 'Account Owner Name', {
                                    required: 'Account owner name is required',
                                    validate: (value: string) => {
                                        const trimmed = value.trim()
                                        const parts = trimmed.split(/\s+/)
                                        if (parts.length < 2) {
                                            return 'Please enter both first and last name'
                                        }
                                        return true
                                    },
                                })}
                            </div>
                        )}
                        {flow === 'claim' &&
                            user?.user.userId &&
                            !user.user.email &&
                            !hideEmailInput &&
                            renderInput('email', 'E-mail', {
                                required: 'Email is required',
                            })}

                        {/* WITHDRAW FLOW: always show account owner's name field (empty by default) */}
                        {flow !== 'claim' && (
                            <div className="w-full space-y-4">
                                {renderInput('accountOwnerName', 'Account Owner Name', {
                                    required: 'Account owner name is required',
                                    validate: (value: string) => {
                                        const trimmed = value.trim()
                                        const parts = trimmed.split(/\s+/)
                                        if (parts.length < 2) {
                                            return 'Please enter both first and last name'
                                        }
                                        return true
                                    },
                                })}
                            </div>
                        )}

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
                              : isUk
                                ? renderInput(
                                      'accountNumber',
                                      'Account Number',
                                      {
                                          required: 'Account number is required',
                                          validate: (value: string) =>
                                              isValidUKAccountNumber(value) || 'Account number must be 6-8 digits',
                                      },
                                      'text'
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
                        {isUk &&
                            renderInput('sortCode', 'Sort Code', {
                                required: 'Sort code is required',
                                validate: (value: string) => isValidSortCode(value) || 'Sort code must be 6 digits',
                            })}

                        {!isIban && !isUk && (
                            <>
                                {renderInput(
                                    'street',
                                    'Your Street Address',
                                    {
                                        required: 'Street address is required',
                                        maxLength: {
                                            value: STREET_ADDRESS_MAX_LENGTH,
                                            message: 'Street address must be 35 characters or less',
                                        },
                                        minLength: { value: 4, message: 'Street address must be 4 characters or more' },
                                    },
                                    'text',
                                    undefined,
                                    undefined,
                                    true,
                                    STREET_ADDRESS_MAX_LENGTH
                                )}

                                {renderInput('city', 'Your City', { required: 'City is required' })}

                                {renderSelect(
                                    'state',
                                    'Select your state',
                                    (isMx ? MX_STATES : US_STATES).map((state) => ({
                                        label: state.name,
                                        value: state.code,
                                    })),
                                    {
                                        required: 'State is required',
                                    }
                                )}

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
                            loading={isSubmitting || isCheckingBICValid || isValidating}
                            disabled={isSubmitting || !isValid || isCheckingBICValid || isValidating}
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

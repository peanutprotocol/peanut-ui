'use client'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '@/context/authContext'
import { Button } from '@/components/0_Bruddle/Button'
import { AddBankAccountPayload, BridgeAccountOwnerType, BridgeAccountType } from '@/app/actions/types/users.types'
import { ALL_COUNTRIES_ALPHA3_TO_ALPHA2 } from '@/components/AddMoney/consts'
import { useParams, useRouter } from 'next/navigation'
import ErrorAlert from '@/components/Global/ErrorAlert'
import PeanutActionDetailsCard, { PeanutActionDetailsCardProps } from '../Global/PeanutActionDetailsCard'
import { PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants'
import { useWithdrawFlow } from '@/context/WithdrawFlowContext'
import useSavedAccounts from '@/hooks/useSavedAccounts'
import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { bankFormActions } from '@/redux/slices/bank-form-slice'
import { useDebounce } from '@/hooks/useDebounce'

import { IBankAccountDetails } from './types'
import { getAccountType, getStepConfig } from './stepConfig'
import StepIndicator from './StepIndicator'
import PersonalInfoStep from './steps/PersonalInfoStep'
import AccountDetailsStep from './steps/AccountDetailsStep'
import AddressStep from './steps/AddressStep'
import { sanitizeBankAccount } from '@/utils/format.utils'

interface MultiStepBankAccountFormProps {
    country: string
    countryName?: string
    onSuccess: (payload: AddBankAccountPayload, rawData: IBankAccountDetails) => Promise<{ error?: string }>
    initialData?: Partial<IBankAccountDetails>
    flow?: 'claim' | 'withdraw'
    actionDetailsProps?: Partial<PeanutActionDetailsCardProps>
    error: string | null
    hideEmailInput?: boolean
}

export const MultiStepBankAccountForm = forwardRef<{ handleSubmit: () => void }, MultiStepBankAccountFormProps>(
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
        const accountType = getAccountType(country)
        const isMx = accountType === 'MX'
        const isUs = accountType === 'US'
        const isIban = accountType === 'IBAN'

        const { user } = useAuth()
        const dispatch = useAppDispatch()
        const [currentStep, setCurrentStep] = useState(1)
        const [isSubmitting, setIsSubmitting] = useState(false)
        const [submissionError, setSubmissionError] = useState<string | null>(null)
        const { country: countryNameParams } = useParams()
        const { amountToWithdraw, setSelectedBankAccount } = useWithdrawFlow()
        const [firstName, ...lastNameParts] = (user?.user.fullName ?? '').split(' ')
        const lastName = lastNameParts.join(' ')
        const router = useRouter()
        const savedAccounts = useSavedAccounts()
        const [isCheckingBICValid, setisCheckingBICValid] = useState(false)

        const selectedCountry = (countryNameFromProps ?? (countryNameParams as string)).toLowerCase()
        const stepConfig = getStepConfig(accountType)

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
                // Normalize identifiers before comparison: remove spaces, hyphens, dots, underscores and convert to lowercase
                const inputIdentifier = sanitizeBankAccount(isMx ? data.clabe : data.accountNumber)
                const existingAccount = savedAccounts.find(
                    (account) => sanitizeBankAccount(account.identifier) === inputIdentifier
                )

                // Skip adding account if the account already exists for the logged in user
                if (existingAccount) {
                    setSelectedBankAccount(existingAccount)
                    router.push(`/withdraw/${country}/bank`)
                    return
                }

                let bridgeAccountType: BridgeAccountType
                if (isIban) bridgeAccountType = BridgeAccountType.IBAN
                else if (isUs) bridgeAccountType = BridgeAccountType.US
                else if (isMx) bridgeAccountType = BridgeAccountType.CLABE
                else throw new Error('Unsupported country')

                const accountNumber = isMx ? data.clabe : data.accountNumber

                const { firstName, lastName } = data
                let bic = data.bic || getValues('bic')
                const iban = data.iban || getValues('iban')

                const payload: Partial<AddBankAccountPayload> = {
                    accountType: bridgeAccountType,
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

        const handleNext = () => {
            if (currentStep < stepConfig.totalSteps) {
                setCurrentStep(currentStep + 1)
            }
        }

        const handleStepSubmit = () => {
            if (currentStep === stepConfig.totalSteps) {
                handleSubmit(onSubmit)()
            } else {
                handleNext()
            }
        }

        const currentFormData = watch()
        const isCurrentStepValid = stepConfig.isStepValid(currentStep, currentFormData, errors)
        const isLastStep = currentStep === stepConfig.totalSteps

        const countryCodeForFlag = useMemo(() => {
            return ALL_COUNTRIES_ALPHA3_TO_ALPHA2[country.toUpperCase()] ?? country.toUpperCase()
        }, [country])

        const renderCurrentStep = () => {
            switch (currentStep) {
                case 1:
                    return (
                        <PersonalInfoStep
                            control={control}
                            errors={errors}
                            touchedFields={touchedFields}
                            flow={flow}
                            user={user}
                            hideEmailInput={hideEmailInput}
                        />
                    )
                case 2:
                    return (
                        <AccountDetailsStep
                            control={control}
                            errors={errors}
                            touchedFields={touchedFields}
                            accountType={accountType}
                            selectedCountry={selectedCountry}
                            setValue={setValue}
                            getValues={getValues}
                            debouncedBicValue={debouncedBicValue}
                            setisCheckingBICValid={setisCheckingBICValid}
                            submissionError={submissionError}
                            setSubmissionError={setSubmissionError}
                        />
                    )
                case 3:
                    return <AddressStep control={control} errors={errors} touchedFields={touchedFields} />
                default:
                    return null
            }
        }

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
                    <h2 className="font-bold text-black">{stepConfig.getStepTitle(currentStep)}</h2>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault()
                            handleStepSubmit()
                        }}
                        className="space-y-4"
                    >
                        {renderCurrentStep()}

                        <StepIndicator currentStep={currentStep} stepConfig={stepConfig} />

                        <Button
                            type="submit"
                            variant="purple"
                            shadowSize="4"
                            className={twMerge(currentStep > 1 ? 'flex-1' : 'w-full')}
                            loading={isSubmitting || isCheckingBICValid}
                            disabled={isSubmitting || !isCurrentStepValid || isCheckingBICValid}
                        >
                            {isLastStep ? 'Review' : 'Next'}
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

MultiStepBankAccountForm.displayName = 'MultiStepBankAccountForm'

export default MultiStepBankAccountForm

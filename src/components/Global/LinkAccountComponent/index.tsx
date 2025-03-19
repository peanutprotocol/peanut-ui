import { Step, Steps, useSteps } from 'chakra-ui-steps'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

import { KYCComponent } from '@/components/Kyc'
import { useAuth } from '@/context/authContext'
import { IResponse } from '@/interfaces'
import * as utils from '@/utils'
import { formatBankAccountDisplay, sanitizeBankAccount } from '@/utils/format.utils'
import Link from 'next/link'
import { isIBAN } from 'validator'
import CountryDropdown from '../CountrySelect'
import Icon from '../Icon'
import Loading from '../Loading'
import * as Sentry from '@sentry/nextjs'

const steps = [{ label: '1. Bank Account' }, { label: '2. Confirm details' }]

interface IGlobaLinkAccountComponentProps {
    accountNumber?: string
    onCompleted?: () => void
}

interface IRegisterAccountDetails {
    street: string
    city: string
    state: string
    postalCode: string
    country: string
    accountNumber: string
    routingNumber: string
    BIC: string
    type: string // account type: iban or us
}

export const GlobaLinkAccountComponent = ({ accountNumber, onCompleted }: IGlobaLinkAccountComponentProps) => {
    const {
        setStep: setActiveStep,
        activeStep,
        nextStep: goToNext,
    } = useSteps({
        initialStep: 0,
    })
    const [loadingState, setLoadingState] = useState<'idle' | 'validating' | 'creating' | 'linking'>('idle')
    const isLoading = loadingState !== 'idle'
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [reKYCUrl, setReKYCUrl] = useState<string | undefined>(undefined) // state to set KYC url, if re-kyc verification is required
    const [completedLinking, setCompletedLinking] = useState(false)
    const {
        register: registerAccountDetails,
        formState: { errors: accountDetailsErrors },
        watch: accountDetailsWatch,
        setValue: setAccountDetailsValue,
        getValues: getAccountDetailsValue,
        setError: setAccountDetailsError,
        clearErrors: clearAccountDetailsErrors,
        handleSubmit: handleAccountDetailsSubmit,
    } = useForm<IRegisterAccountDetails>({
        mode: 'onChange',
        defaultValues: {
            street: '',
            city: '',
            state: '',
            postalCode: '',
            country: '',
            routingNumber: '',
            BIC: '',
            type: 'iban',
        },
    })
    const {
        register: registerIban,
        formState: { errors: ibanErrors },
        setError: setIbanFormError,
        getValues: getIbanFormValue,
        handleSubmit: handleIbanSubmit,
    } = useForm({
        mode: 'onChange',
        defaultValues: {
            accountNumber: accountNumber ? sanitizeBankAccount(accountNumber) : '',
        },
    })
    const { user, fetchUser } = useAuth()

    const [needsAddressInput, setNeedsAddressInput] = useState(false)

    useEffect(() => {
        if (accountNumber && /^[0-9]{6,26}$/.test(accountNumber)) {
            // Extract routing number (first 9 digits) and account number (rest)
            const routingNumber = accountNumber.slice(0, 9)
            const bankAccountNumber = accountNumber.slice(9)

            // Pre-fill the form
            setAccountDetailsValue('routingNumber', routingNumber)
            setAccountDetailsValue('accountNumber', bankAccountNumber)
        } else if (accountNumber) {
            // If it's an IBAN, just set it as is
            setAccountDetailsValue('accountNumber', accountNumber)
        }
    }, [accountNumber, setAccountDetailsValue])

    useEffect(() => {
        if (getAccountDetailsValue('type') === 'us') {
            setAccountDetailsValue('country', 'USA')
        }
    }, [getAccountDetailsValue('type')])

    useEffect(() => {
        // Check if we need to show address input fields
        if (getAccountDetailsValue('type') === 'us') {
            if (!user?.user?.kycStatus || user.user.kycStatus !== 'approved') {
                // Always show address fields for unverified users
                setNeedsAddressInput(true)
            } else {
                // For verified users, check if we have a valid address
                const hasValidAddress = user.accounts.some((account) => {
                    if (!account.account_details) return false

                    const details =
                        typeof account.account_details === 'string'
                            ? JSON.parse(account.account_details)
                            : account.account_details

                    return details.street && details.city && details.state && details.postalCode
                })
                setNeedsAddressInput(!hasValidAddress)
            }
        } else {
            setNeedsAddressInput(false)
        }
    }, [user, getAccountDetailsValue('type')])

    const validateUSAccount = (routingNumber: string, accountNumber: string) => {
        if (!/^[0-9]{9}$/.test(routingNumber)) {
            return 'Invalid routing number - must be 9 digits'
        }
        if (!/^[0-9]{1,17}$/.test(accountNumber)) {
            return 'Invalid account number'
        }
        return null
    }

    const handleCheckIban = async ({ accountNumber }: { accountNumber: string | undefined }) => {
        try {
            setErrorState({
                showError: false,
                errorMessage: '',
            })
            setLoadingState('validating')

            if (!accountNumber) return

            const sanitizedAccountNumber = sanitizeBankAccount(accountNumber)

            if (isIBAN(sanitizedAccountNumber)) {
                setAccountDetailsValue('type', 'iban')
                const isValid = await utils.validateBankAccount(sanitizedAccountNumber)
                if (!isValid) {
                    setIbanFormError('accountNumber', { message: 'Invalid IBAN' })
                    return
                }
            } else if (/^[0-9]{1,17}$/.test(sanitizedAccountNumber)) {
                setAccountDetailsValue('type', 'us')
                setAccountDetailsValue('accountNumber', sanitizedAccountNumber)
                setAccountDetailsValue('routingNumber', '')
            } else {
                setIbanFormError('accountNumber', { message: 'Invalid account number' })
                return
            }

            goToNext()
        } catch (error) {
            Sentry.captureException(error)
            console.error(error)
        } finally {
            setLoadingState('idle')
        }
    }

    const handleSubmitLinkIban = async (formData: IRegisterAccountDetails) => {
        try {
            setLoadingState('creating')
            setErrorState({
                showError: false,
                errorMessage: '',
            })
            setReKYCUrl(undefined)

            // verify if user and bridge_customer_id exists
            if (!user?.user) {
                throw new Error('User not found. Please log in again.')
            }

            const customerId = user.user.bridge_customer_id
            if (!customerId) {
                console.error('Missing bridge_customer_id:', user.user)
                throw new Error('Please complete KYC before linking a bank account.')
            }

            // get customer ID and name
            let accountOwnerName = user.user.full_name
            if (!accountOwnerName) {
                const bridgeCustomer = await utils.getCustomer(customerId)
                accountOwnerName = `${bridgeCustomer.first_name} ${bridgeCustomer.last_name}`
            }

            let address
            if (formData.type === 'us') {
                if (user?.user?.kycStatus === 'approved') {
                    console.log('User accounts:', user.accounts)

                    // Find account with valid address details
                    const existingAccount = user.accounts.find((account) => {
                        console.log('Checking account:', account)
                        if (!account.account_details) {
                            console.log('No account_details for account:', account.account_identifier)
                            return false
                        }

                        // Check if account_details is already an object
                        const details =
                            typeof account.account_details === 'string'
                                ? JSON.parse(account.account_details)
                                : account.account_details

                        console.log('Account details:', details)

                        const hasRequiredFields = details.street && details.city && details.state && details.postalCode

                        console.log('Has required fields:', hasRequiredFields)
                        console.log('Field values:', {
                            street: details.street,
                            city: details.city,
                            state: details.state,
                            postalCode: details.postalCode,
                        })

                        const allFieldsNonEmpty = Object.values(details).every(
                            (value): value is string => typeof value === 'string' && value.trim() !== ''
                        )

                        console.log('All fields non-empty:', allFieldsNonEmpty)

                        return hasRequiredFields && allFieldsNonEmpty
                    })

                    console.log('Found account with valid address:', existingAccount)

                    if (existingAccount?.account_details) {
                        try {
                            // Same here - check if it's already an object
                            const details =
                                typeof existingAccount.account_details === 'string'
                                    ? JSON.parse(existingAccount.account_details)
                                    : existingAccount.account_details

                            // Use the existing address but ensure country is USA for Bridge API
                            address = {
                                ...details,
                                country: 'USA', // Override country to USA for US bank accounts
                            }
                            console.log('Using existing address (modified for US):', address)
                        } catch (error) {
                            Sentry.captureException(error)
                            console.error('Failed to handle address details:', error)
                        }
                    }
                }

                // If no valid address found from existing accounts, require form data
                if (!address || !address.street || !address.city || !address.state || !address.postalCode) {
                    console.log('No valid existing address found, using form data:', formData)
                    if (!formData.street || !formData.city || !formData.state || !formData.postalCode) {
                        setErrorState({
                            showError: true,
                            errorMessage: 'Please fill in all US address fields',
                        })
                        return
                    }
                    address = {
                        street: formData.street,
                        city: formData.city,
                        country: 'USA',
                        state: formData.state,
                        postalCode: formData.postalCode,
                    }
                }
            }

            // Prepare account details based on type
            const accountDetails =
                formData.type === 'iban'
                    ? {
                          accountNumber: getIbanFormValue('accountNumber'),
                          bic: formData.BIC,
                          country: utils.getThreeCharCountryCodeFromIban(getIbanFormValue('accountNumber') ?? ''),
                      }
                    : {
                          accountNumber: getIbanFormValue('accountNumber'),
                          routingNumber: formData.routingNumber,
                      }

            // Create the external account
            const createExternalAccountRes: IResponse = await utils.createExternalAccount(
                customerId,
                formData.type as 'iban' | 'us',
                accountDetails,
                address,
                accountOwnerName
            )

            // handle verification requirement first
            if (!createExternalAccountRes.data.success) {
                // check for verification URL

                if (createExternalAccountRes.data.details?.code === 'endorsement_requirements_not_met') {
                    const verificationUrl = createExternalAccountRes.data.details.requirements.kyc_with_proof_of_address

                    setErrorState({
                        showError: true,
                        errorMessage:
                            createExternalAccountRes.data?.message ||
                            'Please complete the verification process to continue.',
                    })

                    if (verificationUrl) {
                        setReKYCUrl(verificationUrl)
                    }
                    return
                }

                const bridgeAccountId = createExternalAccountRes.data.id

                if (!!bridgeAccountId) {
                    // add account to database
                    await utils.createAccount(
                        user.user.userId,
                        customerId,
                        bridgeAccountId,
                        formData.type,
                        accountDetails.accountNumber,
                        createExternalAccountRes.data
                    )

                    // re-fetch user to get recently added accounts
                    await fetchUser()

                    onCompleted ? onCompleted() : setCompletedLinking(true)
                }
            }
        } catch (error) {
            console.error('Error in handleSubmitLinkIban:', error)
            setErrorState({
                showError: true,
                errorMessage: error instanceof Error ? error.message : 'Failed to link bank account. Please try again.',
            })
            Sentry.captureException(error)
        } finally {
            setLoadingState('idle')
        }
    }

    const formatDisplayValue = (value: string) => {
        return formatBankAccountDisplay(value, getAccountDetailsValue('type') as 'iban' | 'us')
    }

    const renderComponent = () => {
        switch (activeStep) {
            case 0:
                return (
                    <form
                        className="flex w-full flex-col items-start justify-center gap-2"
                        onSubmit={handleIbanSubmit(handleCheckIban)}
                    >
                        <input
                            {...registerIban('accountNumber', {
                                required: 'This field is required',
                                setValueAs: (value: string) => value?.toLowerCase(), // Store as lowercase
                            })}
                            className={`custom-input ${ibanErrors.accountNumber ? 'border border-red' : ''}`}
                            placeholder={'Bank account'}
                            autoComplete="on"
                            name="bank-account"
                            value={formatDisplayValue(getIbanFormValue('accountNumber') || '')} // Display formatted
                            onChange={(e) => {
                                // Remove spaces and store lowercase
                                const rawValue = e.target.value.replace(/\s/g, '')
                                registerIban('accountNumber').onChange({
                                    target: {
                                        value: rawValue.toLowerCase(),
                                        name: 'accountNumber',
                                    },
                                })
                            }}
                        />
                        {ibanErrors.accountNumber && (
                            <span className="text-h9 font-normal text-red">{ibanErrors.accountNumber.message}</span>
                        )}
                        <button type="submit" className="btn btn-purple h-8 w-full" disabled={isLoading}>
                            {isLoading ? (
                                <div className="flex w-full flex-row items-center justify-center gap-2">
                                    <Loading />
                                    {loadingState === 'validating' && 'Validating...'}
                                    {loadingState === 'creating' && 'Creating account...'}
                                    {loadingState === 'linking' && 'Linking account...'}
                                </div>
                            ) : (
                                'Confirm'
                            )}
                        </button>
                        {errorState.showError && (
                            <div className="text-start">
                                {reKYCUrl ? (
                                    <div className="flex flex-col gap-2">
                                        <label className="whitespace-normal text-h8 font-normal text-red">
                                            {errorState.errorMessage}{' '}
                                            <a
                                                href={reKYCUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="underline"
                                            >
                                                Click here to complete the process.
                                            </a>
                                        </label>
                                    </div>
                                ) : (
                                    <label className="text-h8 font-normal text-red">{errorState.errorMessage}</label>
                                )}
                            </div>
                        )}
                    </form>
                )
            case 1:
                return (
                    <form
                        className="flex w-full flex-col items-start justify-center gap-2"
                        onSubmit={handleAccountDetailsSubmit(handleSubmitLinkIban)}
                    >
                        {getAccountDetailsValue('type') === 'us' ? (
                            <div className="flex w-full flex-col gap-4">
                                <div className="flex flex-col gap-2">
                                    <input
                                        {...registerAccountDetails('routingNumber', {
                                            required: 'Routing number is required',
                                            pattern: {
                                                value: /^[0-9]{9}$/,
                                                message: 'Routing number must be 9 digits',
                                            },
                                        })}
                                        className={`custom-input ${accountDetailsErrors.routingNumber ? 'border border-red' : ''}`}
                                        placeholder="Enter your routing number"
                                    />
                                    <span className="text-h9 font-light">
                                        Your 9-digit routing number can be found at the bottom of your checks or in your
                                        bank's online portal
                                    </span>
                                    {accountDetailsErrors.routingNumber && (
                                        <span className="text-h9 font-normal text-red">
                                            {accountDetailsErrors.routingNumber.message}
                                        </span>
                                    )}
                                </div>

                                <div className="flex flex-col gap-2">
                                    <input
                                        disabled
                                        value={formatBankAccountDisplay(getAccountDetailsValue('accountNumber'), 'us')}
                                        className="custom-input bg-gray-100"
                                        placeholder="Account number"
                                    />
                                    <span className="text-h9 font-light">Your account number</span>
                                </div>

                                {needsAddressInput && (
                                    <div className="flex w-full flex-col gap-4 border-t border-gray-200 pt-4">
                                        <span className="text-h8 font-medium">Your US address details</span>

                                        <input
                                            {...registerAccountDetails('street', {
                                                required: 'Street address is required',
                                            })}
                                            className={`custom-input ${accountDetailsErrors.street ? 'border border-red' : ''}`}
                                            placeholder="Street address"
                                        />
                                        {accountDetailsErrors.street && (
                                            <span className="text-h9 font-normal text-red">
                                                {accountDetailsErrors.street.message}
                                            </span>
                                        )}

                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <input
                                                    {...registerAccountDetails('city', {
                                                        required: 'City is required',
                                                    })}
                                                    className={`custom-input ${accountDetailsErrors.city ? 'border border-red' : ''}`}
                                                    placeholder="City"
                                                />
                                                {accountDetailsErrors.city && (
                                                    <span className="text-h9 font-normal text-red">
                                                        {accountDetailsErrors.city.message}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <input
                                                    {...registerAccountDetails('state', {
                                                        required: 'State is required',
                                                    })}
                                                    className={`custom-input ${accountDetailsErrors.state ? 'border border-red' : ''}`}
                                                    placeholder="State"
                                                />
                                                {accountDetailsErrors.state && (
                                                    <span className="text-h9 font-normal text-red">
                                                        {accountDetailsErrors.state.message}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex w-full flex-col gap-2 md:flex-row">
                                            <div className="flex-1">
                                                <input
                                                    {...registerAccountDetails('postalCode', {
                                                        required: 'ZIP code is required',
                                                    })}
                                                    className={`custom-input ${accountDetailsErrors.postalCode ? 'border border-red' : ''}`}
                                                    placeholder="ZIP code"
                                                />
                                                {accountDetailsErrors.postalCode && (
                                                    <span className="text-h9 font-normal text-red">
                                                        {accountDetailsErrors.postalCode.message}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="pointer-events-none flex-1 opacity-50">
                                                <CountryDropdown
                                                    value="USA"
                                                    onChange={(value: string) => {
                                                        setAccountDetailsValue('country', value)
                                                    }}
                                                    error={accountDetailsErrors.country?.message}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                <input
                                    {...registerAccountDetails('BIC', {
                                        required:
                                            getAccountDetailsValue('type') === 'iban'
                                                ? 'This field is required'
                                                : false,
                                        pattern: {
                                            value: /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/,
                                            message: 'Please enter a valid BIC/SWIFT code',
                                        },
                                    })}
                                    className={`custom-input ${accountDetailsErrors.BIC ? 'border border-red' : ''}`}
                                    placeholder="BIC"
                                />
                                {accountDetailsErrors.BIC && (
                                    <span className="text-h9 font-normal text-red">
                                        {accountDetailsErrors.BIC.message}
                                    </span>
                                )}
                            </>
                        )}
                        <button type="submit" className="btn btn-purple h-8 w-full" disabled={isLoading}>
                            {isLoading ? (
                                <div className="flex w-full flex-row items-center justify-center gap-2">
                                    <Loading />
                                    {loadingState === 'validating' && 'Validating...'}
                                    {loadingState === 'creating' && 'Creating account...'}
                                    {loadingState === 'linking' && 'Linking account...'}
                                </div>
                            ) : (
                                'Confirm'
                            )}
                        </button>
                        {errorState.showError && (
                            <div className="text-start">
                                {reKYCUrl ? (
                                    <div className="flex flex-col gap-2">
                                        <label className="whitespace-normal text-h8 font-normal text-red">
                                            {errorState.errorMessage}{' '}
                                            <a
                                                href={reKYCUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="underline"
                                            >
                                                Click here to complete the process.
                                            </a>
                                        </label>
                                    </div>
                                ) : (
                                    <label className="text-h8 font-normal text-red">{errorState.errorMessage}</label>
                                )}
                            </div>
                        )}
                    </form>
                )
        }
    }

    return user?.user?.kycStatus === 'approved' ? (
        completedLinking ? (
            <div className="flex w-full flex-col items-center justify-center gap-6 py-2 pb-20 text-start">
                <p>You have successfully linked your account!</p>
                <Link
                    className="absolute bottom-0 flex h-20 w-[27rem] w-full flex-row items-center justify-start gap-2 border-t-[1px] border-black bg-purple-3  px-4.5 dark:text-black"
                    href={'/profile'}
                >
                    <div className=" border border-n-1 p-0 px-1">
                        <Icon name="profile" className="-mt-0.5" />
                    </div>
                    See your accounts.
                </Link>
            </div>
        ) : (
            <div className="flex w-full flex-col items-center justify-center gap-6 px-2 text-start">
                <p className="text-h8 font-normal">
                    Complete the following steps to link your bank account to your Peanut profile for a smooth cashout
                    experience.
                </p>
                <Steps
                    variant={'circles'}
                    orientation="vertical"
                    colorScheme="purple"
                    activeStep={activeStep}
                    onClickStep={(step: number) => setActiveStep(step)}
                    sx={{
                        '& .cui-steps__vertical-step': {
                            '&:last-of-type': {
                                paddingBottom: '0px',
                                gap: '0px',
                            },
                        },
                        '& .cui-steps__vertical-step-content': {
                            '&:last-of-type': {
                                minHeight: '8px',
                            },
                        },
                    }}
                >
                    {steps.map(({ label }, index) => (
                        <Step label={label} key={label}>
                            <div className="relative z-10 flex w-full items-center justify-center md:pr-[40px]">
                                {renderComponent()}
                            </div>
                        </Step>
                    ))}
                </Steps>
                {}
            </div>
        )
    ) : (
        <KYCComponent />
    )
}

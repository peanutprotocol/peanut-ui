import { Step, Steps, useSteps } from 'chakra-ui-steps'
import { useContext, useMemo, useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'

import * as utils from '@/utils'
import * as context from '@/context'
import Loading from '../Loading'
import CountryDropdown from '../CountrySelect'
import Link from 'next/link'
import Icon from '../Icon'
import { useAuth } from '@/context/authContext'
import { Divider } from '@chakra-ui/react'
import { isIBAN } from 'validator'
import { IBridgeAccount, IResponse } from '@/interfaces'
import { USBankAccountInput } from '../USBankAccountInput'
import { sanitizeBankAccount, formatIBANDisplay } from '@/utils/format.utils'

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

            console.log('Submitting form data:', formData)

            // Add validation for US routing number
            if (formData.type === 'us' && !formData.routingNumber) {
                console.log('Missing routing number')
                setErrorState({
                    showError: true,
                    errorMessage: 'Please enter your routing number',
                })
                setLoadingState('idle')
                return
            }

            // Get address from the user's existing account if available
            const existingAccount = user?.accounts?.find((account) => account.account_details)
            const existingAddress = existingAccount?.account_details
                ? JSON.parse(existingAccount.account_details)
                : null

            // Rest of validation
            const isFormValid = await utils.validateAccountFormData(
                {
                    ...formData,
                    accountNumber: getIbanFormValue('accountNumber'),
                    // If user has KYC'd account, use its address
                    ...(user?.user?.kycStatus === 'verified' && existingAddress
                        ? {
                              street: existingAddress.street,
                              city: existingAddress.city,
                              state: existingAddress.state,
                              postalCode: existingAddress.postalCode,
                              country: existingAddress.country,
                          }
                        : {}),
                },
                setAccountDetailsError
            )

            if (!isFormValid) {
                console.log('Form validation failed')
                setErrorState({
                    showError: true,
                    errorMessage: 'Please check all fields and try again',
                })
                setLoadingState('idle')
                return
            }

            // Check if user?.accounts already has an account with this identifier
            const accountExists = user?.accounts.find(
                (account) =>
                    account.account_identifier.replaceAll(/\s/g, '').toLowerCase() ===
                    getIbanFormValue('accountNumber')?.replaceAll(/\s/g, '').toLowerCase()
            )

            if (accountExists) {
                setErrorState({ showError: true, errorMessage: 'This account has already been linked' })
                return
            }

            const customerId = user?.user?.bridge_customer_id ?? ''
            const accountType = formData.type

            const accountDetails =
                accountType === 'iban'
                    ? {
                          accountNumber: getIbanFormValue('accountNumber'),
                          bic: formData.BIC,
                          country: utils.getThreeCharCountryCodeFromIban(getIbanFormValue('accountNumber') ?? ''),
                      }
                    : { accountNumber: getIbanFormValue('accountNumber'), routingNumber: formData.routingNumber }

            const address =
                user?.user?.kycStatus === 'verified' && existingAddress
                    ? existingAddress
                    : {
                          street: formData.street,
                          city: formData.city,
                          country: formData.country,
                          state: formData.state,
                          postalCode: formData.postalCode,
                      }

            let accountOwnerName = user?.user?.full_name

            if (!accountOwnerName) {
                const bridgeCustomer = await utils.getCustomer(customerId)
                accountOwnerName = `${bridgeCustomer.first_name} ${bridgeCustomer.last_name}`
            }

            if (!customerId) {
                throw new Error('Customer ID is missing')
            }

            const response: IResponse = await utils.createExternalAccount(
                customerId,
                accountType as 'iban' | 'us',
                accountDetails,
                address,
                accountOwnerName
            )

            if (!response.success) {
                setErrorState({
                    showError: true,
                    errorMessage: response.message || 'Failed to create external account',
                })
                return
            }

            const data: IBridgeAccount = response.data

            await utils.createAccount(
                user?.user?.userId ?? '',
                customerId,
                data.id,
                accountType,
                getIbanFormValue('accountNumber')?.replaceAll(/\s/g, '') ?? '',
                address
            )
            await fetchUser()

            onCompleted ? onCompleted() : setCompletedLinking(true)
        } catch (error) {
            console.error('Error in handleSubmitLinkIban:', error)
            const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
            setErrorState({ showError: true, errorMessage })
        } finally {
            setLoadingState('idle')
        }
    }

    const formatDisplayValue = (value: string) => {
        return formatIBANDisplay(value)
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
                            <div className="text-center">
                                <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
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
                                        value={formatIBANDisplay(getAccountDetailsValue('accountNumber'))}
                                        className="custom-input bg-gray-100"
                                        placeholder="Account number"
                                    />
                                    <span className="text-h9 font-light">Your account number</span>
                                </div>

                                {(!user?.user?.kycStatus || user.user.kycStatus !== 'verified') && (
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

                                        <div className="flex gap-2">
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
                            <div className="text-center">
                                <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                            </div>
                        )}
                    </form>
                )
        }
    }

    return user?.user?.kycStatus === 'verified' ? (
        completedLinking ? (
            <div className="flex w-full flex-col items-center justify-center gap-6 py-2 pb-20 text-center">
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
            <div className="flex w-full flex-col items-center justify-center gap-6 px-2  text-center">
                <p className="text-h8 font-normal">
                    Complete the following steps to link your bank account to your peanut profile for a smooth cashout
                    experience.
                </p>
                <Steps
                    variant={'circles'}
                    orientation="vertical"
                    colorScheme="purple"
                    activeStep={activeStep}
                    onClickStep={(step) => setActiveStep(step)}
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
                            <div className="relative z-10 flex w-full items-center justify-center pr-[40px]">
                                {renderComponent()}
                            </div>
                        </Step>
                    ))}
                </Steps>
                {}
            </div>
        )
    ) : (
        <div className="flex w-full flex-col items-center justify-center gap-6 py-2 text-center">
            <p className="text-h6">
                Before you can link an account, please login or register & complete the kyc process.
            </p>
            <div className="flex w-full flex-col items-center justify-center gap-2">
                <Link className="btn btn-xl h-8" href={'/login'}>
                    Login
                </Link>
                <span className="flex w-full flex-row items-center justify-center gap-2">
                    <Divider borderColor={'black'} />
                    <p>or</p>
                    <Divider borderColor={'black'} />
                </span>
                <Link className="btn btn-xl h-8" href={'/register'}>
                    Register
                </Link>
            </div>
        </div>
    )
}

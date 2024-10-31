import { Step, Steps, useSteps } from 'chakra-ui-steps'
import { useContext, useMemo, useState } from 'react'
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

const steps = [{ label: 'Step 1: Enter bank account' }, { label: 'Step 2: Provide details' }]

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
    const [loadingState, setLoadingState] = useState<string>('Idle')
    const isLoading = useMemo(() => loadingState !== 'Idle', [loadingState])
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
            accountNumber: accountNumber,
        },
    })
    const { user, fetchUser } = useAuth()

    const handleCheckIban = async ({ accountNumber }: { accountNumber: string | undefined }) => {
        try {
            setErrorState({
                showError: false,
                errorMessage: '',
            })
            setLoadingState('Loading')

            if (!accountNumber) return

            // strip all whitespaces (tabs, spaces, etc.)
            const sanitizedAccountNumber = accountNumber.replaceAll(/\s/g, '').toLowerCase()

            if (isIBAN(sanitizedAccountNumber)) {
                setAccountDetailsValue('type', 'iban')
            } else if (/^[0-9]{6,17}$/.test(sanitizedAccountNumber)) {
                setAccountDetailsValue('type', 'us')
            } else {
                setIbanFormError('accountNumber', { message: 'Invalid account number' })
                return
            }
            console.log(`Set bank account type to ${getAccountDetailsValue('type')} for ${sanitizedAccountNumber}`)

            const isValidIban = await utils.validateBankAccount(sanitizedAccountNumber)
            if (!isValidIban) {
                setIbanFormError('accountNumber', { message: 'Invalid account number' })
                return
            }

            goToNext()
        } catch (error) {
            console.error(error)
        } finally {
            setLoadingState('Idle')
        }
    }

    const handleSubmitLinkIban = async (formData: IRegisterAccountDetails) => {
        try {
            setLoadingState('Loading')
            setErrorState({
                showError: false,
                errorMessage: '',
            })

            const isFormValid = await utils.validateAccountFormData(
                { ...formData, accountNumber: getIbanFormValue('accountNumber') },
                setAccountDetailsError
            )

            if (!isFormValid) {
                return
            }

            // Check if user?.accounts already has an account wit this identifier
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
            const address = {
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
                if (response.data && response.data.code == 'duplicate_external_account') {
                    // bridge account already exists for this IBAN
                    const errorMessage =
                        'An external account with the same information has already been added for this customer'
                    throw new Error(errorMessage)
                }
                throw new Error('Creating Bridge account failed')
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
            console.error('Error during the submission process:', error)
            setErrorState({ showError: true, errorMessage: String(error) })
        } finally {
            setLoadingState('Idle')
        }
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
                            })}
                            className={`custom-input ${ibanErrors.accountNumber ? 'border border-red' : ''}`}
                            placeholder={'Bank account'}
                            autoComplete="on"
                            name="bankAccount"
                        />
                        {ibanErrors.accountNumber && (
                            <span className="text-h9 font-normal text-red">{ibanErrors.accountNumber.message}</span>
                        )}
                        <button type="submit" className="btn btn-purple h-8 w-full" disabled={isLoading}>
                            {isLoading ? (
                                <div className="flex w-full flex-row items-center justify-center gap-2">
                                    <Loading /> {loadingState}
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
                        {getAccountDetailsValue('type') === 'iban' ? (
                            <>
                                <input
                                    {...registerAccountDetails('BIC', {
                                        required:
                                            getAccountDetailsValue('type') === 'iban'
                                                ? 'This field is required'
                                                : false,
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
                        ) : (
                            <>
                                <input
                                    {...registerAccountDetails('routingNumber', {
                                        required:
                                            getAccountDetailsValue('type') === 'us' ? 'This field is required' : false,
                                    })}
                                    className={`custom-input ${accountDetailsErrors.routingNumber ? 'border border-red' : ''}`}
                                    placeholder="Routing number"
                                />
                                {accountDetailsErrors.routingNumber && (
                                    <span className="text-h9 font-normal text-red">
                                        {accountDetailsErrors.routingNumber.message}
                                    </span>
                                )}
                            </>
                        )}
                        {getAccountDetailsValue('type') === 'us' && (
                            <div className="flex w-full flex-col items-start justify-center gap-2">
                                <input
                                    {...registerAccountDetails('street', {
                                        required:
                                            getAccountDetailsValue('type') === 'us' ? 'This field is required' : false,
                                    })}
                                    className={`custom-input ${accountDetailsErrors.street ? 'border border-red' : ''}`}
                                    placeholder="Your street and number"
                                />
                                {accountDetailsErrors.street && (
                                    <span className="text-h9 font-normal text-red">
                                        {accountDetailsErrors.street.message}
                                    </span>
                                )}

                                <div className="mx-0 flex w-full flex-row items-start justify-between gap-2">
                                    <div className="flex w-full flex-col items-start justify-center gap-2">
                                        <input
                                            {...registerAccountDetails('city', {
                                                required:
                                                    getAccountDetailsValue('type') === 'us'
                                                        ? 'This field is required'
                                                        : false,
                                            })}
                                            className={`custom-input ${accountDetailsErrors.city ? 'border border-red' : ''}`}
                                            placeholder="Your city"
                                        />
                                        {accountDetailsErrors.city && (
                                            <span className="text-h9 font-normal text-red">
                                                {accountDetailsErrors.city.message}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex w-full flex-col items-center justify-center gap-2">
                                        <input
                                            {...registerAccountDetails('postalCode', {
                                                required:
                                                    getAccountDetailsValue('type') === 'us'
                                                        ? 'This field is required'
                                                        : false,
                                            })}
                                            className={`custom-input ${accountDetailsErrors.postalCode ? 'border border-red' : ''}`}
                                            placeholder="Your postal code"
                                        />
                                        {accountDetailsErrors.postalCode && (
                                            <span className="text-h9 font-normal text-red">
                                                {accountDetailsErrors.postalCode.message}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="mx-0 flex w-full flex-row items-start justify-between gap-2">
                                    <div className="flex w-full flex-col items-start justify-center gap-2">
                                        <input
                                            {...registerAccountDetails('state', {
                                                required:
                                                    getAccountDetailsValue('type') === 'us'
                                                        ? 'This field is required'
                                                        : false,
                                            })}
                                            className={`custom-input ${accountDetailsErrors.state ? 'border border-red' : ''}`}
                                            placeholder="Your state "
                                        />
                                        {accountDetailsErrors.state && (
                                            <span className="text-h9 font-normal text-red">
                                                {accountDetailsErrors.state.message}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex w-full flex-col items-center justify-center gap-2">
                                        <CountryDropdown
                                            value={accountDetailsWatch('country')}
                                            onChange={(value: any) => {
                                                setAccountDetailsValue('country', value, { shouldValidate: true })
                                                clearAccountDetailsErrors('country')
                                            }}
                                            error={accountDetailsErrors.country?.message}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        <button type="submit" className="btn btn-purple h-8 w-full" disabled={isLoading}>
                            {isLoading ? (
                                <div className="flex w-full flex-row items-center justify-center gap-2">
                                    <Loading /> {loadingState}
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

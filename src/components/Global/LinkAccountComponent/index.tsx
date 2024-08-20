import { Step, Steps, useSteps } from 'chakra-ui-steps'
import { useContext, useState } from 'react'
import { useForm } from 'react-hook-form'

import * as context from '@/context'
import Loading from '../Loading'
import CountryDropdown from '../CountrySelect'

const steps = [{ label: 'Step 1: Enter bank account' }, { label: 'Step 2: Provide details' }]

interface IGlobaLinkAccountComponentProps {}

interface IRegisterAccountDetails {
    street: string
    city: string
    state: string
    postalCode: string
    country: string
    accountNumber: string
    routingNumber: string
    BIC: string
    type: string
}

export const GlobaLinkAccountComponent = () => {
    const {
        setStep: setActiveStep,
        activeStep,
        nextStep: goToNext,
    } = useSteps({
        initialStep: 0,
    })
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)

    const {
        register: registerAccountDetails,
        formState: { errors: accountDetailsErrors },
        watch: accountDetailsWatch,
        setValue: setAccountDetailsValue,
        setError: setAccountDetailsError,
        handleSubmit: handleAccountDetailsSubmit,
    } = useForm<IRegisterAccountDetails>({
        mode: 'onChange',
        defaultValues: {
            street: '',
            city: '',
            state: '',
            postalCode: '',
            country: '',
            accountNumber: '',
            routingNumber: '',
            BIC: '',
            type: 'iban',
        },
    })
    const {
        register: registerIban,
        formState: { errors: ibanErrors },
        watch: ibanFormWatch,
        setValue: setIbanFormValue,
        setError: setIbanFormError,
        handleSubmit: handleIbanSubmit,
    } = useForm({
        mode: 'onChange',
        defaultValues: {
            accountNumber: '',
        },
    })

    const [recipientType, setRecipientType] = useState<'iban' | 'us'>('iban')

    // const handleSubmitLinkIban = async () => {
    //     const formData = accountFormWatch()
    //     const isFormValid = utils.validateAccountFormData(formData, setAccountFormError)

    //     if (!isFormValid) {
    //         console.log('Form is invalid')
    //         return
    //     }

    //     try {
    //         if (recipientType === 'iban') setLoadingState('Linking IBAN')
    //         else if (recipientType === 'us') setLoadingState('Linking account')

    //         const customerId = customerObject?.customer_id ?? user?.user?.bridge_customer_id
    //         const accountType = formData.type
    //         const accountDetails =
    //             accountType === 'iban'
    //                 ? {
    //                       accountNumber: formData.accountNumber,
    //                       bic: formData.BIC,
    //                       country: utils.getThreeCharCountryCodeFromIban(formData.accountNumber),
    //                   }
    //                 : { accountNumber: formData.accountNumber, routingNumber: formData.routingNumber }
    //         const address = {
    //             street: formData.street,
    //             city: formData.city,
    //             country: formData.country ?? 'BEL',
    //             state: formData.state,
    //             postalCode: formData.postalCode,
    //         }
    //         let accountOwnerName = offrampForm.name ?? user?.user?.full_name

    //         if (!customerId) {
    //             throw new Error('Customer ID is missing')
    //         }

    //         if (!accountOwnerName) {
    //             const bridgeCustomer = await utils.getCustomer(customerId)
    //             accountOwnerName = `${bridgeCustomer.first_name} ${bridgeCustomer.last_name}`
    //         }

    //         const data = await utils.createExternalAccount(
    //             customerId,
    //             accountType as 'iban' | 'us',
    //             accountDetails,
    //             address,
    //             accountOwnerName
    //         )

    //         await utils.createAccount(
    //             user?.user?.userId ?? '',
    //             customerId,
    //             data.id,
    //             accountType,
    //             formData.accountNumber.replaceAll(' ', ''),
    //             address
    //         )
    //         await fetchUser()

    //         // const liquidationAddressDetails = await utils.createLiquidationAddress(
    //         //     customerId,
    //         //     offrampChainAndToken.chain,
    //         //     offrampChainAndToken.token,
    //         //     data.id,
    //         //     recipientType === 'iban' ? 'sepa' : 'ach',
    //         //     recipientType === 'iban' ? 'eur' : 'usd'
    //         // )

    //         // setLiquidationAddress(liquidationAddressDetails)
    //         setActiveStep(3)
    //         setAddressRequired(false)
    //         setLoadingState('Idle')
    //         onCompleted && onCompleted()
    //     } catch (error) {
    //         console.error('Error during the submission process:', error)
    //         setErrorState({ showError: true, errorMessage: 'An error occurred. Please try again later' })

    //         setLoadingState('Idle')
    //     }
    // }

    const handleCheckIban = async ({ accountNumber }: { accountNumber: string }) => {
        console.log('Checking IBAN', accountNumber)
        setRecipientType('us')
        goToNext()
    }

    const handleSubmitLinkIban = async (formData: IRegisterAccountDetails) => {
        console.log('Checking IBAN ', formData)
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
                    </form>
                )
            case 1:
                return (
                    <form
                        className="flex w-full flex-col items-start justify-center gap-2"
                        onSubmit={handleAccountDetailsSubmit(handleSubmitLinkIban)}
                    >
                        {recipientType === 'iban' ? (
                            <>
                                <input
                                    {...registerAccountDetails('BIC', {
                                        required: recipientType === 'iban' ? 'This field is required' : false,
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
                                        required: recipientType === 'us' ? 'This field is required' : false,
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
                        {recipientType === 'us' && (
                            <div className="flex w-full flex-col items-start justify-center gap-2">
                                <input
                                    {...registerAccountDetails('street', {
                                        required: recipientType === 'us' ? 'This field is required' : false,
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
                                                required: recipientType === 'us' ? 'This field is required' : false,
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
                                                required: recipientType === 'us' ? 'This field is required' : false,
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
                                                required: recipientType === 'us' ? 'This field is required' : false,
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
                                                setAccountDetailsError('country', { message: undefined })
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
                    </form>
                )
        }
    }

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 px-2  text-center">
            <p className="text-h8 font-normal">
                This is your first time using a bank account on peanut. You'll have to pass a brief KYC check to
                proceed.
            </p>
            <Steps
                variant={'circles'}
                orientation="vertical"
                colorScheme="purple"
                activeStep={activeStep}
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
        </div>
    )
}

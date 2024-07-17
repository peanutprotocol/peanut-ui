'use client'

import * as _consts from '../../Claim.consts'
import * as context from '@/context'
import { useContext, useEffect, useState } from 'react'
import Loading from '@/components/Global/Loading'
import * as _interfaces from '../../Claim.interfaces'
import * as _utils from '../../Claim.utils'
import * as interfaces from '@/interfaces'

import { useForm } from 'react-hook-form'
import Icon from '@/components/Global/Icon'
import MoreInfo from '@/components/Global/MoreInfo'
import CountryDropdown from '@/components/Global/CountrySelect'
import useClaimLink from '../../useClaimLink'
import * as utils from '@/utils'
import { Step, Steps, useSteps } from 'chakra-ui-steps'

const steps = [
    { label: 'Step 1: Provide personal details' },
    { label: 'Step 2: Agree to TOS' },
    { label: 'Step 3: Complete KYC' },
    { label: 'Step 4: Link bank account' },
]

export const ConfirmClaimLinkIbanView = ({
    onPrev,
    onNext,
    offrampForm,
    setOfframpForm,
    claimLinkData,
    recipientType,
    setTransactionHash,
    tokenPrice,
    liquidationAddress,
    setLiquidationAddress,
    attachment,
    estimatedPoints,
    peanutAccount,
    setPeanutAccount,
    peanutUser,
    setPeanutUser,
    offrampChainAndToken,
    offrampXchainNeeded,
}: _consts.IClaimScreenProps) => {
    const [addressRequired, setAddressRequired] = useState<boolean>(false)
    const [customerObject, setCustomerObject] = useState<interfaces.KYCData | null>(null)
    const [tosLinkOpened, setTosLinkOpened] = useState<boolean>(false)
    const [kycLinkOpened, setKycLinkOpened] = useState<boolean>(false)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const [initiatedProcess, setInitiatedProcess] = useState<boolean>(false)
    const { claimLink, claimLinkXchain } = useClaimLink()

    const {
        register: registerOfframp,
        watch: watchOfframp,
        formState: { errors },
    } = useForm<_consts.IOfframpForm>({
        mode: 'onChange',
        defaultValues: offrampForm,
    })

    const {
        register: registerAccount,
        formState: { errors: accountErrors },
        watch: accountFormWatch,
        setValue: setAccountFormValue,
        setError: setAccountFormError,
    } = useForm({
        mode: 'onChange',
        defaultValues: {
            street: '',
            city: '',
            state: '',
            postalCode: '',
            country: '',
            accountNumber: offrampForm.recipient,
            routingNumber: '',
            BIC: '',
            type: recipientType,
        },
    })

    const handleEmail = async (inputFormData: _consts.IOfframpForm) => {
        setOfframpForm(inputFormData)
        setActiveStep(0)
        setInitiatedProcess(true)

        try {
            setLoadingState('Getting KYC status')

            let data = await _utils.getUserLinks(inputFormData)
            setCustomerObject(data)

            let { tos_status: tosStatus, kyc_status: kycStatus } = data

            if (tosStatus !== 'approved') {
                goToNext()
                return
            }

            if (kycStatus !== 'approved') {
                setActiveStep(2)
                return
            }
            recipientType === 'us' && setAddressRequired(true)
            const peanutUser = await _utils.createUser(data.customer_id, inputFormData.email, inputFormData.name)
            setPeanutUser(peanutUser.user)
            setActiveStep(3)
        } catch (error: any) {
            console.error('Error during the submission process:', error)

            setErrorState({ showError: true, errorMessage: 'An error occurred. Please try again later' })

            setLoadingState('Idle')
        } finally {
            setLoadingState('Idle')
        }
    }

    const handleTOSStatus = async () => {
        try {
            // Handle TOS status
            if (!customerObject) return
            const { tos_status: tosStatus, id, tos_link } = customerObject

            if (tosStatus !== 'approved') {
                setLoadingState('Awaiting TOS confirmation')

                console.log('Awaiting TOS confirmation...')
                await _utils.awaitStatusCompletion(
                    id,
                    'tos',
                    tosStatus,
                    tos_link,
                    setTosLinkOpened,
                    setKycLinkOpened,
                    tosLinkOpened,
                    kycLinkOpened
                )
            } else {
                console.log('TOS already approved.')
            }
            setLoadingState('Idle')
            goToNext()
        } catch (error) {
            console.error('Error during the submission process:', error)

            setErrorState({ showError: true, errorMessage: 'An error occurred. Please try again later' })

            setLoadingState('Idle')
        } finally {
            setLoadingState('Idle')
        }
    }

    const handleKYCStatus = async () => {
        try {
            if (!customerObject) return
            const { kyc_status: kycStatus, id, kyc_link } = customerObject
            if (kycStatus === 'under_review') {
                setErrorState({
                    showError: true,
                    errorMessage: 'KYC under review',
                })
            } else if (kycStatus === 'rejected') {
                setErrorState({
                    showError: true,
                    errorMessage: 'KYC rejected',
                })
            } else if (kycStatus !== 'approved') {
                setLoadingState('Awaiting KYC confirmation')
                console.log('Awaiting KYC confirmation...')
                await _utils.awaitStatusCompletion(
                    id,
                    'kyc',
                    kycStatus,
                    kyc_link,
                    setTosLinkOpened,
                    setKycLinkOpened,
                    tosLinkOpened,
                    kycLinkOpened
                )
            } else {
                console.log('KYC already approved.')
            }

            // Get customer ID
            const customer = await _utils.getStatus(customerObject.id, 'customer_id')
            setCustomerObject({ ...customerObject, customer_id: customer.customer_id })

            const { email, name } = watchOfframp()
            // Create a user in our DB
            const peanutUser = await _utils.createUser(customer.customer_id, email, name)
            setPeanutUser(peanutUser.user)

            recipientType === 'us' && setAddressRequired(true)
            setLoadingState('Idle')

            goToNext()
        } catch (error) {
            console.error('Error during the submission process:', error)

            setErrorState({ showError: true, errorMessage: 'An error occurred. Please try again later' })

            setLoadingState('Idle')
        } finally {
            setLoadingState('Idle')
        }
    }

    const handleSubmitLinkIban = async () => {
        const formData = accountFormWatch()
        const isFormValid = _utils.validateAccountFormData(formData, setAccountFormError)

        if (!isFormValid) {
            console.log('Form is invalid')
            return
        }

        try {
            if (recipientType === 'iban') setLoadingState('Linking IBAN')
            else if (recipientType === 'us') setLoadingState('Linking account')

            const customerId = customerObject?.customer_id
            const accountType = formData.type
            const accountDetails =
                accountType === 'iban'
                    ? {
                          accountNumber: formData.accountNumber,
                          bic: formData.BIC,
                          country: _utils.getThreeCharCountryCodeFromIban(formData.accountNumber),
                      }
                    : { accountNumber: formData.accountNumber, routingNumber: formData.routingNumber }
            const address = {
                street: formData.street,
                city: formData.city,
                country: formData.country ?? 'BEL',
                state: formData.state,
                postalCode: formData.postalCode,
            }
            const accountOwnerName = offrampForm.name

            if (!customerId) {
                throw new Error('Customer ID is missing')
            }

            const data = await _utils.createExternalAccount(
                customerId,
                accountType as 'iban' | 'us',
                accountDetails,
                address,
                accountOwnerName
            )

            const pAccount = await _utils.createAccount(
                peanutUser.user_id,
                customerId,
                data.id,
                accountType,
                formData.accountNumber.replaceAll(' ', ''),
                address
            )

            setPeanutAccount(pAccount)

            const liquidationAddressDetails = await _utils.createLiquidationAddress(
                customerObject.customer_id ?? '',
                offrampChainAndToken.chain,
                offrampChainAndToken.token,
                data.id,
                recipientType === 'iban' ? 'sepa' : 'ach',
                recipientType === 'iban' ? 'eur' : 'usd'
            )

            setLiquidationAddress(liquidationAddressDetails)
            setActiveStep(3)
            setAddressRequired(false)
            setLoadingState('Idle')
        } catch (error) {
            console.error('Error during the submission process:', error)
            setErrorState({ showError: true, errorMessage: 'An error occurred. Please try again later' })

            setLoadingState('Idle')
        }
    }

    const handleSubmitTransfer = async () => {
        try {
            const formData = accountFormWatch()
            setLoadingState('Submitting Offramp')
            console.log('liquidationAddressInfo:', liquidationAddress)
            if (!liquidationAddress) return
            const chainId = _utils.getChainIdFromBridgeChainName(offrampChainAndToken.chain) ?? ''
            const tokenAddress =
                _utils.getTokenAddressFromBridgeTokenName(chainId ?? '10', offrampChainAndToken.token) ?? ''
            console.log({
                offrampXchainNeeded,
                offrampChainAndToken,
                liquidationAddress,
                claimLinkData,
                chainId,
                tokenAddress,
            })

            let hash
            if (offrampXchainNeeded) {
                const chainId = _utils.getChainIdFromBridgeChainName(offrampChainAndToken.chain) ?? ''
                const tokenAddress =
                    _utils.getTokenAddressFromBridgeTokenName(chainId ?? '10', offrampChainAndToken.token) ?? ''
                hash = await claimLinkXchain({
                    address: liquidationAddress.address,
                    link: claimLinkData.link,
                    destinationChainId: chainId,
                    destinationToken: tokenAddress,
                })
            } else {
                hash = await claimLink({
                    address: liquidationAddress.address,
                    link: claimLinkData.link,
                })
            }

            console.log(hash)

            if (hash) {
                utils.saveOfframpLinkToLocalstorage({
                    data: {
                        ...claimLinkData,
                        depositDate: new Date(),
                        USDTokenPrice: tokenPrice,
                        points: estimatedPoints,
                        txHash: hash,
                        message: attachment.message ? attachment.message : undefined,
                        attachmentUrl: attachment.attachmentUrl ? attachment.attachmentUrl : undefined,
                        liquidationAddress: liquidationAddress.address,
                        recipientType: recipientType,
                        accountNumber: formData.accountNumber,
                        bridgeCustomerId: peanutUser.bridge_customer_id,
                        bridgeExternalAccountId: peanutAccount.bridge_account_id,
                        peanutCustomerId: peanutUser.user_id,
                        peanutExternalAccountId: peanutAccount.account_id,
                    },
                })
                setTransactionHash(hash)
                console.log('Transaction hash:', hash)
                setLoadingState('Idle')
                onNext()
            }
        } catch (error) {
            console.error('Error during the submission process:', error)

            setErrorState({ showError: true, errorMessage: 'An error occurred. Please try again later' })
            setLoadingState('Idle')
        }
    }

    useEffect(() => {
        if (liquidationAddress) {
            setActiveStep(4)
        }
    }, [liquidationAddress])

    const {
        setStep: setActiveStep,
        activeStep,
        nextStep: goToNext,
    } = useSteps({
        initialStep: 0,
    })

    const renderComponent = () => {
        switch (activeStep) {
            case 0:
                return (
                    <div className="flex w-full flex-col items-start justify-center gap-2">
                        <input
                            {...registerOfframp('name', { required: 'This field is required' })}
                            className={`custom-input custom-input-xs ${errors.name ? 'border border-red' : ''}`}
                            placeholder="Full name"
                            disabled={initiatedProcess || activeStep > 0}
                        />
                        {errors.name && <span className="text-h9 font-normal text-red">{errors.name.message}</span>}

                        <input
                            {...registerOfframp('email', { required: 'This field is required' })}
                            className={`custom-input custom-input-xs ${errors.email ? 'border border-red' : ''}`}
                            placeholder="Email"
                            type="email"
                            disabled={initiatedProcess || activeStep > 0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleEmail(watchOfframp())
                                }
                            }}
                        />
                        {errors.email && <span className="text-h9 font-normal text-red">{errors.email.message}</span>}
                        <button
                            onClick={() => {
                                handleEmail(watchOfframp())
                            }}
                            className="btn btn-purple h-8 w-full"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <div className="flex w-full flex-row items-center justify-center gap-2">
                                    <Loading /> {loadingState}
                                </div>
                            ) : (
                                'Next'
                            )}
                        </button>
                    </div>
                )

            case 1:
                return (
                    <div className="mb-2 flex flex-col items-center justify-center gap-2">
                        <button
                            onClick={() => {
                                if (isLoading) {
                                    window.open(customerObject?.tos_link, '_blank')
                                } else handleTOSStatus()
                            }}
                            className="btn btn-purple h-8 w-full"
                        >
                            {isLoading ? 'Reopen TOS' : 'Open TOS'}
                        </button>
                        {isLoading && (
                            <span className="flex flex-row items-center justify-center gap-1">
                                <Loading />
                                Awaiting TOS confirmation
                            </span>
                        )}
                    </div>
                )

            case 2:
                return (
                    <div className="mb-2 flex flex-col items-center justify-center gap-2">
                        <button
                            onClick={() => {
                                if (isLoading) {
                                    window.open(customerObject?.kyc_link, '_blank')
                                } else handleKYCStatus()
                            }}
                            className="btn btn-purple h-8 w-full"
                        >
                            {isLoading ? 'Reopen KYC' : 'Open KYC'}
                        </button>
                        {isLoading && (
                            <span className="flex flex-row items-center justify-center gap-1">
                                <Loading />
                                Awaiting KYC confirmation
                            </span>
                        )}
                    </div>
                )

            case 3:
                return (
                    <div className="flex w-full flex-col items-start justify-center gap-2">
                        <input
                            {...registerAccount('accountNumber', {
                                required: 'This field is required',
                            })}
                            className={`custom-input ${accountErrors.accountNumber ? 'border border-red' : ''}`}
                            placeholder={recipientType === 'iban' ? 'IBAN' : 'Account number'}
                        />
                        {accountErrors.accountNumber && (
                            <span className="text-h9 font-normal text-red">{accountErrors.accountNumber.message}</span>
                        )}
                        {recipientType === 'iban' ? (
                            <>
                                <input
                                    {...registerAccount('BIC', {
                                        required: addressRequired ? 'This field is required' : false,
                                    })}
                                    className={`custom-input ${accountErrors.BIC ? 'border border-red' : ''}`}
                                    placeholder="BIC"
                                />
                                {accountErrors.BIC && (
                                    <span className="text-h9 font-normal text-red">{accountErrors.BIC.message}</span>
                                )}
                            </>
                        ) : (
                            <>
                                <input
                                    {...registerAccount('routingNumber', {
                                        required: addressRequired ? 'This field is required' : false,
                                    })}
                                    className={`custom-input ${accountErrors.routingNumber ? 'border border-red' : ''}`}
                                    placeholder="Routing number"
                                />
                                {accountErrors.routingNumber && (
                                    <span className="text-h9 font-normal text-red">
                                        {accountErrors.routingNumber.message}
                                    </span>
                                )}
                            </>
                        )}
                        {addressRequired && (
                            <div className="flex w-full flex-col items-start justify-center gap-2">
                                <input
                                    {...registerAccount('street', {
                                        required: addressRequired ? 'This field is required' : false,
                                    })}
                                    className={`custom-input ${accountErrors.street ? 'border border-red' : ''}`}
                                    placeholder="Street and number"
                                />
                                {accountErrors.street && (
                                    <span className="text-h9 font-normal text-red">{accountErrors.street.message}</span>
                                )}

                                <div className="mx-0 flex w-full flex-row items-start justify-between gap-2">
                                    <div className="flex w-full flex-col items-start justify-center gap-2">
                                        <input
                                            {...registerAccount('city', {
                                                required: addressRequired ? 'This field is required' : false,
                                            })}
                                            className={`custom-input ${accountErrors.city ? 'border border-red' : ''}`}
                                            placeholder="City"
                                        />
                                        {accountErrors.city && (
                                            <span className="text-h9 font-normal text-red">
                                                {accountErrors.city.message}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex w-full flex-col items-center justify-center gap-2">
                                        <input
                                            {...registerAccount('postalCode', {
                                                required: addressRequired ? 'This field is required' : false,
                                            })}
                                            className={`custom-input ${accountErrors.postalCode ? 'border border-red' : ''}`}
                                            placeholder="Postal code"
                                        />
                                        {accountErrors.postalCode && (
                                            <span className="text-h9 font-normal text-red">
                                                {accountErrors.postalCode.message}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="mx-0 flex w-full flex-row items-start justify-between gap-2">
                                    <div className="flex w-full flex-col items-start justify-center gap-2">
                                        <input
                                            {...registerAccount('state', {
                                                required: addressRequired ? 'This field is required' : false,
                                            })}
                                            className={`custom-input ${accountErrors.state ? 'border border-red' : ''}`}
                                            placeholder="State "
                                        />
                                        {accountErrors.state && (
                                            <span className="text-h9 font-normal text-red">
                                                {accountErrors.state.message}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex w-full flex-col items-center justify-center gap-2">
                                        <CountryDropdown
                                            value={accountFormWatch('country')}
                                            onChange={(value: any) => {
                                                setAccountFormValue('country', value, { shouldValidate: true })
                                                setAccountFormError('country', { message: undefined })
                                            }}
                                            error={accountErrors.country?.message}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        <button
                            onClick={() => {
                                handleSubmitLinkIban()
                            }}
                            className="btn btn-purple h-8 w-full"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <div className="flex w-full flex-row items-center justify-center gap-2">
                                    <Loading /> {loadingState}
                                </div>
                            ) : (
                                'Confirm'
                            )}
                        </button>{' '}
                    </div>
                )
        }
    }

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 px-2 text-center">
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
            {activeStep === 4 && (
                <div className="flex w-full flex-col items-center justify-center gap-2">
                    <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                        <div className="flex w-max  flex-row items-center justify-center gap-1">
                            <Icon name={'profile'} className="h-4 fill-gray-1" />
                            <label className="font-bold">Name</label>
                        </div>
                        <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                            {offrampForm.name}
                        </span>
                    </div>
                    <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                        <div className="flex w-max  flex-row items-center justify-center gap-1">
                            <Icon name={'email'} className="h-4 fill-gray-1" />
                            <label className="font-bold">Email</label>
                        </div>
                        <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                            {offrampForm.email}
                        </span>
                    </div>

                    <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                        <div className="flex w-max  flex-row items-center justify-center gap-1">
                            <Icon name={'money-in'} className="h-4 fill-gray-1" />
                            <label className="font-bold">Bank account</label>
                        </div>
                        <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                            {accountFormWatch('accountNumber')}
                        </span>
                    </div>

                    <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                        <div className="flex w-max  flex-row items-center justify-center gap-1">
                            <Icon name={'forward'} className="h-4 fill-gray-1" />
                            <label className="font-bold">Route</label>
                        </div>
                        <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                            Offramp <Icon name={'arrow-next'} className="h-4 fill-gray-1" />{' '}
                            {recipientType.toUpperCase()}{' '}
                            <MoreInfo text={`Wait, crypto can be converted to real money??? How cool!`} />
                        </span>
                    </div>
                    <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                        <div className="flex w-max  flex-row items-center justify-center gap-1">
                            <Icon name={'gas'} className="h-4 fill-gray-1" />
                            <label className="font-bold">Fee</label>
                        </div>
                        <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                            $0
                            <MoreInfo text={'Fees are on us, enjoy!'} />
                        </span>
                    </div>
                    <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                        <div className="flex w-max  flex-row items-center justify-center gap-1">
                            <Icon name={'transfer'} className="h-4 fill-gray-1" />
                            <label className="font-bold">Total received</label>
                        </div>
                        <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                            ${utils.formatTokenAmount(tokenPrice * parseFloat(claimLinkData.tokenAmount))}{' '}
                            <MoreInfo text={'Woop Woop free offramp!'} />
                        </span>
                    </div>
                </div>
            )}
            <div className="flex w-full flex-col items-center justify-center gap-2">
                {activeStep === 4 && (
                    <button
                        onClick={() => {
                            handleSubmitTransfer()
                        }}
                        className="btn-purple btn-xl"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <div className="flex w-full flex-row items-center justify-center gap-2">
                                <Loading /> {loadingState}
                            </div>
                        ) : (
                            'Claim now'
                        )}
                    </button>
                )}
                <button
                    className="btn btn-xl dark:border-white dark:text-white"
                    onClick={() => {
                        onPrev()
                        setActiveStep(0)
                        setErrorState({ showError: false, errorMessage: '' })
                        setOfframpForm({ email: '', name: '', recipient: '' })
                        setAccountFormValue('accountNumber', '')
                        setAccountFormValue('BIC', '')
                        setAccountFormValue('routingNumber', '')
                        setAccountFormValue('street', '')
                        setAccountFormValue('city', '')
                        setAccountFormValue('state', '')
                        setAccountFormValue('postalCode', '')
                        setAccountFormValue('country', '')
                        setPeanutAccount({ account_id: '', bridge_account_id: '', user_id: '' })
                        setPeanutUser({ user_id: '', bridge_customer_id: '' })
                        setLiquidationAddress(undefined)
                    }} // TODO: add reset of everything
                    disabled={isLoading}
                    type="button"
                >
                    Return
                </button>
                {errorState.showError && errorState.errorMessage === 'KYC under review' ? (
                    <div className="text-center">
                        <label className=" text-h8 font-normal text-red ">
                            KYC is under review, we might need additional documents. Please reach out via{' '}
                            <a href="https://discord.gg/uWFQdJHZ6j" target="_blank" className="underline">
                                discord
                            </a>{' '}
                            to finish the process.
                        </label>
                    </div>
                ) : errorState.errorMessage === 'KYC rejected' ? (
                    <div className="text-center">
                        <label className=" text-h8 font-normal text-red ">
                            KYC has been rejected. Please reach out via{' '}
                            <a href="https://discord.gg/uWFQdJHZ6j" target="_blank" className="underline">
                                {' '}
                                discord{' '}
                            </a>{' '}
                            .
                        </label>
                    </div>
                ) : (
                    <div className="text-center">
                        <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                    </div>
                )}
            </div>
        </div>
    )
}

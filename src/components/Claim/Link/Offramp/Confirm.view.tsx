'use client'

import * as _consts from '../../Claim.consts'
import * as context from '@/context'
import { useContext, useEffect, useState } from 'react'
import Loading from '@/components/Global/Loading'
import * as _interfaces from '../../Claim.interfaces'
import * as _utils from '../../Claim.utils'
import * as interfaces from '@/interfaces'
import {
    StepIcon,
    StepIndicator,
    StepSeparator,
    StepStatus,
    Stepper,
    Stack,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Tabs,
    StepTitle,
} from '@chakra-ui/react'
import { useForm } from 'react-hook-form'
import Icon from '@/components/Global/Icon'
import MoreInfo from '@/components/Global/MoreInfo'
import CountryDropdown from '@/components/Global/CountrySelect'
import useClaimLink from '../../useClaimLink'
import * as utils from '@/utils'
import { Step, Steps, useSteps } from 'chakra-ui-steps'

const steps = [
    { label: 'Step 1: Provide personal information' },
    { label: 'Step 2: Agree to TOS' },
    { label: 'Step 3: Complete KYC' },
    { label: 'Step 4: Submit Account Number' },
    { label: 'Step 5: Confirm' },
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
}: _consts.IClaimScreenProps) => {
    const [addressRequired, setAddressRequired] = useState<boolean>(false)
    const [customerObject, setCustomerObject] = useState<interfaces.KYCData | null>(null)
    const [tosLinkOpened, setTosLinkOpened] = useState<boolean>(false)
    const [kycLinkOpened, setKycLinkOpened] = useState<boolean>(false)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [retryState, setRetryState] = useState<{
        showRetry: boolean
        retryLink: string
        type: 'tos' | 'kyc' | undefined
    }>({ showRetry: false, retryLink: '', type: undefined })
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const [initiatedProcess, setInitiatedProcess] = useState<boolean>(false)
    const { claimLink } = useClaimLink()

    const {
        register: registerOfframp,
        handleSubmit: handleSubmitOfframp,
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

    const handleTOSStatus = async (id: string, tosStatus: string, tos_link: string) => {
        if (tosStatus !== 'approved') {
            setLoadingState('Awaiting TOS confirmation')
            setRetryState({
                showRetry: true,
                retryLink: tos_link,
                type: 'tos',
            })
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
        goToNext()
    }

    const handleKYCStatus = async (id: string, kycStatus: string, kyc_link: string) => {
        if (kycStatus === 'under_review') {
            throw new Error('KYC is under review.')
        } else if (kycStatus !== 'approved') {
            setLoadingState('Awaiting KYC confirmation')
            setRetryState({
                showRetry: true,
                retryLink: kyc_link,
                type: 'kyc',
            })
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
        goToNext()
    }

    const onSubmitTosAndKyc = async (inputFormData: _consts.IOfframpForm) => {
        setOfframpForm(inputFormData)
        setActiveStep(0)
        setInitiatedProcess(true)

        try {
            setLoadingState('Getting KYC status')

            console.log(inputFormData)

            let data = await _utils.getUserLinks(inputFormData)
            setCustomerObject(data)

            let { tos_status: tosStatus, kyc_status: kycStatus } = data

            // Handle TOS status
            await handleTOSStatus(data.id, tosStatus, data.tos_link)

            // Wait for 1 second cause some browsers prevent opening two page blanks quickly after eachother
            await new Promise((resolve) => setTimeout(resolve, 1000)) // TODO: check if removing is possible
            // Handle KYC status
            await handleKYCStatus(data.id, kycStatus, data.kyc_link)

            // Reset retry state
            setRetryState({ showRetry: false, retryLink: '', type: undefined })

            // Get customer ID
            const customer = await _utils.getStatus(data.id, 'customer_id')
            setCustomerObject({ ...data, customer_id: customer.customer_id })

            // Create a user in our DB
            const peanutUser = await _utils.createUser(customer.customer_id, inputFormData.email, inputFormData.name)
            setPeanutUser(peanutUser.user)

            setActiveStep(2)
            recipientType === 'us' && setAddressRequired(true)
        } catch (error: any) {
            console.error('Error during the submission process:', error)
            if (error.message === 'KYC is under review.') {
                setErrorState({ showError: true, errorMessage: 'KYC is under review. Please come back later' })
            } else if (error.message === 'TOS is under review.') {
                setErrorState({ showError: true, errorMessage: 'TOS is under review. Please come back later' })
            } else {
                setErrorState({ showError: true, errorMessage: 'An error occurred. Please try again later' })
            }
            setLoadingState('Idle')
        } finally {
            setLoadingState('Idle')
        }
    }

    const onSubmitLinkIban = async () => {
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
                claimLinkData.chainId,
                claimLinkData.tokenAddress,
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
            setLoadingState('Idle')
        }
    }

    const onSubmitTransfer = async () => {
        try {
            const formData = accountFormWatch()
            setLoadingState('Submitting Offramp')
            console.log('liquidationAddressINfo:', liquidationAddress)
            if (!liquidationAddress) return
            const hash = await claimLink({
                address: liquidationAddress.address,
                link: claimLinkData.link,
            })
            if (hash) {
                console.log(customerObject, peanutUser)
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
            setLoadingState('Idle')
        }
    }

    const handleSubmit = async (inputFormData: _consts.IOfframpForm) => {
        if (activeStep === 0) {
            await onSubmitTosAndKyc(inputFormData)
        } else if (activeStep === 2) {
            await onSubmitLinkIban()
        } else if (activeStep === 3) {
            await onSubmitTransfer()
        }
    }

    useEffect(() => {
        if (liquidationAddress) {
            setActiveStep(3)
        }
    }, [liquidationAddress])

    const {
        nextStep: goToNext,
        setStep: setActiveStep,
        activeStep,
    } = useSteps({
        initialStep: 0,
    })
    const isLastStep = activeStep === steps.length - 1
    const hasCompletedAllSteps = activeStep === steps.length

    const renderComponent = () => {
        switch (activeStep) {
            case 0:
                return (
                    <div className="flex w-full flex-col items-start justify-center gap-2">
                        <input
                            {...registerOfframp('name', { required: 'This field is required' })}
                            className={`custom-input-xs custom-input ${errors.name ? 'border border-red' : ''}`}
                            placeholder="Full name"
                            disabled={initiatedProcess || activeStep > 0}
                        />
                        {errors.name && <span className="text-h9 font-normal text-red">{errors.name.message}</span>}

                        <input
                            {...registerOfframp('email', { required: 'This field is required' })}
                            className={`custom-input-xs custom-input ${errors.email ? 'border border-red' : ''}`}
                            placeholder="Email"
                            type="email"
                            disabled={initiatedProcess || activeStep > 0}
                        />
                        {errors.email && <span className="text-h9 font-normal text-red">{errors.email.message}</span>}
                        <button
                            onClick={() => {
                                goToNext()
                            }}
                            className="btn btn-purple h-8 w-full"
                            disabled={isLoading}
                        >
                            Next
                        </button>
                    </div>
                )

            case 1:
                return (
                    <button
                        onClick={() => {
                            goToNext()
                        }}
                        className="btn btn-purple h-8 w-full"
                        disabled={isLoading}
                    >
                        Confirm TOS
                    </button>
                )

            case 2:
                return (
                    <button
                        onClick={() => {
                            goToNext()
                        }}
                        className="btn btn-purple h-8 w-full"
                        disabled={isLoading}
                    >
                        Complete KYC
                    </button>
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
                                goToNext()
                            }}
                            className="btn btn-purple h-8 w-full"
                            disabled={isLoading}
                        >
                            Submit account number
                        </button>{' '}
                    </div>
                )

            case 4:
                return (
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
                )
        }
    }

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 px-2 text-center">
            <Steps variant={'circles'} orientation="vertical" colorScheme="purple" activeStep={activeStep}>
                {steps.map(({ label }, index) => (
                    <Step label={label} key={label}>
                        <div className=" relative z-10 flex w-full items-center justify-center pr-[40px]">
                            {renderComponent()}
                        </div>
                    </Step>
                ))}
            </Steps>

            <div className="flex w-full flex-col items-center justify-center gap-2">
                {activeStep === 4 && (
                    <button
                        onClick={() => {
                            goToNext()
                        }}
                        className="btn-purple btn-xl"
                        disabled={isLoading}
                    >
                        Confirm
                    </button>
                )}
                <button
                    className="btn btn-xl dark:border-white dark:text-white"
                    onClick={onPrev}
                    disabled={isLoading}
                    type="button"
                >
                    Return
                </button>
                {errorState.showError && (
                    <div className="text-center">
                        <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                    </div>
                )}
            </div>
        </div>
    )
}

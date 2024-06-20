'use client'

import * as _consts from '../../Claim.consts'
import * as context from '@/context'
import { useContext, useState } from 'react'
import Loading from '@/components/Global/Loading'
import * as _interfaces from '../../Claim.interfaces'
import * as _utils from '../../Claim.utils'
import * as interfaces from '@/interfaces'
import * as _offrampUtils from './Offramp.utils'
import {
    Step,
    StepIcon,
    StepIndicator,
    StepSeparator,
    StepStatus,
    Stepper,
    Stack,
    useSteps,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Tabs,
} from '@chakra-ui/react'
import { useForm } from 'react-hook-form'
import Icon from '@/components/Global/Icon'
import MoreInfo from '@/components/Global/MoreInfo'
import CountryDropdown from '@/components/Global/CountrySelect'
import { compareTokenAddresses } from '@/utils'

export const ConfirmClaimLinkIbanView = ({
    onPrev,
    onNext,
    recipient,
    offrampForm,
    setOfframpForm,
    claimLinkData,
    recipientType,
}: _consts.IClaimScreenProps) => {
    const { activeStep, goToNext, goToPrevious, setActiveStep } = useSteps({
        index: 0,
        count: _consts.steps.length,
    })
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)

    const {
        register: registerOfframp,
        handleSubmit: handleSubmitOfframp,
        formState: { errors },
    } = useForm({
        mode: 'onChange',
        defaultValues: offrampForm,
    })

    const {
        register: registerAccount,
        handleSubmit: handleSubmitAccount,
        formState: { errors: accountErrors },
        watch: accountFormWatch,
        setValue: setAccountFormValue,
        setError: setAccountFormError,
    } = useForm({
        mode: 'onChange',
        defaultValues: {
            street: 'paardsdemerstraat 11',
            city: 'hasselt',
            state: 'limburg',
            postalCode: '3500',
            country: 'BEL',
            accountNumber: offrampForm.recipient,
            routingNumber: '',
            BIC: 'GKCCBEBB',
            type: 'iban',
        },
    })

    const [addressRequired, setAddressRequired] = useState<boolean>(false)
    const [customerObject, setCustomerObject] = useState<interfaces.KYCData | null>(null)
    const [tosLinkOpened, setTosLinkOpened] = useState<boolean>(false)
    const [kycLinkOpened, setKycLinkOpened] = useState<boolean>(false)

    const onSubmitTosAndKyc = async (inputFormData: _consts.IOfframpForm) => {
        console.log(inputFormData)
        setOfframpForm(inputFormData)
        setActiveStep(0)

        try {
            setLoadingState('Getting KYC details')
            console.log('Getting KYC details...')

            let data = await _offrampUtils.getUserLinks(inputFormData)
            setCustomerObject(data)
            console.log('KYC details fetched:', data)

            let { tos_status: tosStatus, kyc_status: kycStatus } = data

            // Handle TOS status
            if (tosStatus !== 'approved') {
                setLoadingState('Awaiting TOS confirmation')
                console.log('Awaiting TOS confirmation...')
                await _offrampUtils.awaitStatusCompletion(
                    data.id,
                    'tos',
                    tosStatus,
                    data.tos_link,
                    setTosLinkOpened,
                    setKycLinkOpened,
                    tosLinkOpened,
                    kycLinkOpened
                )
            } else {
                console.log('TOS already approved.')
            }

            goToNext()

            // Handle KYC status
            if (kycStatus !== 'approved') {
                setLoadingState('Awaiting KYC confirmation')
                console.log('Awaiting KYC completion...')
                await _offrampUtils.awaitStatusCompletion(
                    data.id,
                    'tos',
                    tosStatus,
                    data.tos_link,
                    setTosLinkOpened,
                    setKycLinkOpened,
                    tosLinkOpened,
                    kycLinkOpened
                )
            } else {
                console.log('KYC already approved.')
            }

            goToNext()

            // Handle IBAN linking
            const customer_id = await _offrampUtils.getStatus(data.id, 'customer_id')
            console.log('Customer ID:', customer_id)

            setCustomerObject({ ...data, customer_id: customer_id.customer_id })

            const externalAccounts = await _offrampUtils.getExternalAccounts(customer_id.customer_id)
            console.log('External accounts:', externalAccounts)

            if (!externalAccounts.data.includes(inputFormData.recipient)) {
                setActiveStep(2)
                setAddressRequired(true)
            } else {
                setActiveStep(3)
                setAddressRequired(false)
            }

            setLoadingState('Idle')
            console.log('Process complete. Loading state set to idle.')
        } catch (error) {
            console.error('Error during the submission process:', error)
            setLoadingState('Idle')
        }
    }

    const onSubmitLinkIban = async () => {
        const formData = accountFormWatch()
        const isFormValid = _offrampUtils.validateAccountFormData(formData, setAccountFormError)

        if (!isFormValid) {
            console.log('Form is invalid')
            return
        }

        try {
            setLoadingState('Linking IBAN')
            console.log('Linking IBAN...')

            const customerId = customerObject?.customer_id
            const accountType = formData.type
            const accountDetails =
                accountType === 'iban'
                    ? { accountNumber: formData.accountNumber, bic: formData.BIC, country: formData.country }
                    : { accountNumber: formData.accountNumber, routingNumber: formData.routingNumber }
            const address = {
                street: formData.street,
                city: formData.city,
                country: formData.country,
                state: formData.state,
                postalCode: formData.postalCode,
            }
            const accountOwnerName = offrampForm.name

            if (!customerId) {
                throw new Error('Customer ID is missing')
            }

            // const data = await createExternalAccount(
            //     customerId,
            //     accountType as 'iban' | 'us',
            //     accountDetails,
            //     address,
            //     accountOwnerName
            // )
            // console.log('External account created:', data)

            const data = {
                id: 'fd7cb6e1-76f6-48ed-b35c-1d2b8d3fa9d7',
            }

            const transferDetails = await _offrampUtils.getTransferDetails(
                data.id,
                accountType as 'iban' | 'us',
                claimLinkData.chainId,
                claimLinkData.tokenAddress,
                customerObject?.customer_id ?? '',
                claimLinkData.tokenAmount
            )

            console.log('Transfer details:', transferDetails)

            setLoadingState('Idle')
        } catch (error) {
            console.error('Error during the submission process:', error)
            setLoadingState('Idle')
        }
    }

    const handleOnPrev = () => {
        if (activeStep === 0) {
            onPrev()
        } else {
            goToPrevious()
        }
    }

    const handleSubmit = async (e: any) => {
        if (activeStep === 0) {
            await onSubmitTosAndKyc(offrampForm)
        } else if (activeStep === 2) {
            await onSubmitLinkIban()
        } else if (activeStep === 3) {
            onNext()
        }
    }

    const [tabIndex, setTabIndex] = useState(recipientType === 'iban' ? 0 : 1)

    console.log('Recipient type:', recipientType)

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 px-2 text-center">
            <Stack w={'100%'} className="items-start">
                <Stepper
                    colorScheme={'purple'} // TODO: update colorScheme
                    size="sm"
                    w={'100%'}
                    index={activeStep}
                    gap="0"
                >
                    {_consts.steps.map((step, index) => (
                        <Step key={index} className="gap-0">
                            <StepIndicator className="!mr-0">
                                <StepStatus complete={<StepIcon />} />
                            </StepIndicator>
                            <StepSeparator className="!ml-0 mr-2" />
                        </Step>
                    ))}
                </Stepper>
                {activeStep < _consts.steps.length ? (
                    <label className="text-h7">
                        Step {activeStep + 1}: <b>{_consts.steps[activeStep].title}</b>
                    </label>
                ) : (
                    <label className="text-h7">Verification complete</label>
                )}
            </Stack>
            <form
                className="flex w-full flex-col items-center justify-center gap-6 "
                onSubmit={handleSubmitOfframp(handleSubmit)}
            >
                <div className="flex w-full flex-col items-start justify-center gap-2">
                    <label>We need your details to send you your funds.</label>

                    <input
                        {...registerOfframp('name', { required: 'This field is required' })}
                        className={`custom-input ${errors.name ? 'border border-red' : ''}`}
                        placeholder="Name"
                        disabled={activeStep === _consts.steps.length}
                    />
                    {errors.name && <span className="text-h9 font-normal text-red">{errors.name.message}</span>}

                    <input
                        {...registerOfframp('email', { required: 'This field is required' })}
                        className={`custom-input ${errors.email ? 'border border-red' : ''}`}
                        placeholder="Email"
                        type="email"
                        disabled={activeStep === _consts.steps.length}
                    />
                    {errors.email && <span className="text-h9 font-normal text-red">{errors.email.message}</span>}

                    <input
                        {...registerOfframp('recipient', { required: 'This field is required' })}
                        className={`custom-input ${errors.recipient ? 'border border-red' : ''}`}
                        placeholder="Iban"
                        disabled={activeStep === _consts.steps.length}
                    />
                    {errors.recipient && (
                        <span className="text-h9 font-normal text-red">{errors.recipient.message}</span>
                    )}
                </div>{' '}
                {recipientType === 'iban' ? '' : recipientType === 'us' && ''}
                {addressRequired && (
                    <form className="flex w-full flex-col items-start justify-center gap-0">
                        <Tabs
                            onChange={(index) => {
                                setTabIndex(index)
                                if (index === 0) {
                                    setAccountFormValue('type', 'iban')
                                } else if (index === 1) {
                                    setAccountFormValue('type', 'us')
                                }
                            }}
                            isFitted
                            variant="enclosed"
                            w={'100%'}
                            index={tabIndex}
                        >
                            <TabList>
                                <Tab>IBAN</Tab>
                                <Tab>US</Tab>
                            </TabList>
                            <TabPanels>
                                <TabPanel className="!px-0">
                                    <div className="flex w-full flex-col items-start justify-center gap-2">
                                        <input
                                            {...registerAccount('accountNumber', {
                                                required: addressRequired ? 'This field is required' : false,
                                            })}
                                            className={`custom-input ${accountErrors.accountNumber ? 'border border-red' : ''}`}
                                            placeholder="Account number"
                                        />
                                        {accountErrors.accountNumber && (
                                            <span className="text-h9 font-normal text-red">
                                                {accountErrors.accountNumber.message}
                                            </span>
                                        )}
                                        <input
                                            {...registerAccount('BIC', {
                                                required: addressRequired ? 'This field is required' : false,
                                            })}
                                            className={`custom-input ${accountErrors.BIC ? 'border border-red' : ''}`}
                                            placeholder="BIC"
                                        />
                                        {accountErrors.BIC && (
                                            <span className="text-h9 font-normal text-red">
                                                {accountErrors.BIC.message}
                                            </span>
                                        )}
                                    </div>
                                </TabPanel>
                                <TabPanel className="!px-0">
                                    <div className="flex w-full flex-col items-start justify-center gap-2">
                                        <input
                                            {...registerAccount('accountNumber', {
                                                required: addressRequired ? 'This field is required' : false,
                                            })}
                                            className={`custom-input ${accountErrors.accountNumber ? 'border border-red' : ''}`}
                                            placeholder="Account number"
                                        />
                                        {accountErrors.accountNumber && (
                                            <span className="text-h9 font-normal text-red">
                                                {accountErrors.accountNumber.message}
                                            </span>
                                        )}
                                        <input
                                            {...registerAccount('routingNumber', {
                                                required: addressRequired ? 'This field is required' : false,
                                            })}
                                            className={`custom-input ${accountErrors.routingNumber ? 'border border-red' : ''}`}
                                            placeholder="Routing number"
                                        />{' '}
                                        {accountErrors.routingNumber && (
                                            <span className="text-h9 font-normal text-red">
                                                {accountErrors.routingNumber.message}
                                            </span>
                                        )}
                                    </div>
                                </TabPanel>
                            </TabPanels>
                        </Tabs>
                        <div className="flex w-full flex-col items-start justify-center gap-2">
                            <label>Address</label>
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
                                </div>{' '}
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
                                </div>{' '}
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
                    </form>
                )}
                <div className="flex w-full flex-col items-center justify-center gap-2">
                    {activeStep === _consts.steps.length ? (
                        <div className="flex w-full flex-col items-center justify-center gap-2">
                            <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                                <div className="flex w-max  flex-row items-center justify-center gap-1">
                                    <Icon name={'forward'} className="h-4 fill-gray-1" />
                                    <label className="font-bold">Route</label>
                                </div>
                                <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                    Offramp <Icon name={'arrow-next'} className="h-4 fill-gray-1" /> IBAN{' '}
                                    <MoreInfo text={'Points coming soon! keep an eye out on your dashboard!'} />
                                </span>
                            </div>
                            <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                                <div className="flex w-max  flex-row items-center justify-center gap-1">
                                    <Icon name={'gas'} className="h-4 fill-gray-1" />
                                    <label className="font-bold">Fee</label>
                                </div>
                                <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                    $1 <MoreInfo text={'Points coming soon! keep an eye out on your dashboard!'} />
                                </span>
                            </div>
                            <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                                <div className="flex w-max  flex-row items-center justify-center gap-1">
                                    <Icon name={'transfer'} className="h-4 fill-gray-1" />
                                    <label className="font-bold">Total received</label>
                                </div>
                                <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                    $999 <MoreInfo text={'Points coming soon! keep an eye out on your dashboard!'} />
                                </span>
                            </div>
                        </div>
                    ) : activeStep === _consts.steps.length - 1 ? (
                        <label className="mb-2 w-full text-center text-h8 font-normal">
                            Your address is required to link your IBAN to your account. The Peanut App does not store
                            this.
                        </label>
                    ) : (
                        <label className="mb-2 w-full text-center text-h8 font-normal">
                            The KYC process is done through an external 3rd party. The Peanut App has no access to your
                            KYC details.
                        </label>
                    )}

                    <button className="btn-purple btn-xl" type="submit" disabled={isLoading}>
                        {isLoading ? (
                            <div className="flex w-full flex-row items-center justify-center gap-2">
                                <Loading /> {loadingState}
                            </div>
                        ) : (
                            'Confirm'
                        )}
                    </button>
                    <button
                        className="btn btn-xl dark:border-white dark:text-white"
                        onClick={handleOnPrev}
                        disabled={isLoading}
                        type="button"
                    >
                        Return
                    </button>
                </div>{' '}
            </form>
        </div>
    )
}

export default ConfirmClaimLinkIbanView

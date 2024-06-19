'use client'

import * as _consts from '../../Claim.consts'
import * as context from '@/context'
import { useContext, useState } from 'react'
import Loading from '@/components/Global/Loading'
import * as _interfaces from '../../Claim.interfaces'
import * as _utils from '../../Claim.utils'
import * as interfaces from '@/interfaces'

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

const steps = [
    { title: 'TOS', description: 'Agree to the TOS', buttonText: 'Agree TOS' },
    { title: 'KYC', description: 'Complete KYC', buttonText: 'Complete KYC' },
    { title: 'Link Iban', description: 'Link IBAN to your account', buttonText: 'Link IBAN' },
]

export const ConfirmClaimLinkIbanView = ({
    onPrev,
    onNext,
    recipient,
    offrampForm,
    setOfframpForm,
}: _consts.IClaimScreenProps) => {
    const { activeStep, goToNext, goToPrevious, setActiveStep } = useSteps({
        index: 0,
        count: steps.length,
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
            street: '',
            city: '',
            country: '',
            accountNumber: offrampForm.recipient,
            routingNumber: '',
            BIC: '',
            type: 'iban',
        },
    })

    const [addressRequired, setAddressRequired] = useState<boolean>(false)
    const [customerObject, setCustomerObject] = useState<interfaces.KYCData | null>(null)
    const [tosLinkOpened, setTosLinkOpened] = useState<boolean>(false)
    const [kycLinkOpened, setKycLinkOpened] = useState<boolean>(false)

    async function fetchApi(url: string, method: string, body?: any): Promise<any> {
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch data from ${url}`)
        }

        return await response.json()
    }

    async function getUserLinks(formData: _consts.IOfframpForm) {
        return await fetchApi('/api/bridge/new-user/get-links', 'POST', {
            type: 'individual',
            full_name: formData.name,
            email: formData.email,
        })
    }

    async function getStatus(userId: string, type: string) {
        return await fetchApi('/api/bridge/new-user/get-status', 'POST', {
            userId,
            type,
        })
    }

    async function getExternalAccounts(customerId: string) {
        return await fetchApi('/api/bridge/external-account/get-all-for-customerId', 'POST', {
            customerId,
        })
    }

    async function awaitStatusCompletion(userId: string, type: string, initialStatus: string, link: string) {
        let status = initialStatus

        if (type === 'tos' && !tosLinkOpened) {
            window.open(link, '_blank')
            setTosLinkOpened(true)
        } else if (type === 'kyc' && !kycLinkOpened) {
            window.open(link, '_blank')
            setKycLinkOpened(true)
        }

        while (status !== 'approved') {
            const statusData = await getStatus(userId, type)
            status = statusData[`${type}_status`]
            console.log(`Current ${type.toUpperCase()} status:`, status)

            if (status !== 'approved') {
                await new Promise((resolve) => setTimeout(resolve, 5000)) // wait 5 seconds before checking again
            }
        }

        console.log(`${type.toUpperCase()} completion complete.`)
    }

    const onSubmitTosAndKyc = async (inputFormData: _consts.IOfframpForm) => {
        console.log(inputFormData)
        setOfframpForm(inputFormData)
        setActiveStep(0)

        try {
            setLoadingState('Getting KYC details')
            console.log('Getting KYC details...')

            let data = await getUserLinks(inputFormData)
            setCustomerObject(data)
            console.log('KYC details fetched:', data)

            let { tos_status: tosStatus, kyc_status: kycStatus } = data

            // Handle TOS status
            if (tosStatus !== 'approved') {
                setLoadingState('Awaiting TOS confirmation')
                console.log('Awaiting TOS confirmation...')
                await awaitStatusCompletion(data.id, 'tos', tosStatus, data.tos_link)
            } else {
                console.log('TOS already approved.')
            }

            goToNext()

            // Handle KYC status
            if (kycStatus !== 'approved') {
                setLoadingState('Awaiting KYC confirmation')
                console.log('Awaiting KYC completion...')
                await awaitStatusCompletion(data.id, 'kyc', kycStatus, data.kyc_link)
            } else {
                console.log('KYC already approved.')
            }

            goToNext()

            // Handle IBAN linking
            const customer_id = await getStatus(data.id, 'customer_id')
            console.log('Customer ID:', customer_id)

            setCustomerObject({ ...data, customer_id: customer_id.customer_id })

            const externalAccounts = await getExternalAccounts(customer_id.customer_id)
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
        console.log(accountFormWatch())
        const isFormValid = validateAccountFormData(accountFormWatch())

        console.log('is form valid:', isFormValid)

        try {
        } catch (error) {}
    }

    const validateAccountFormData = (formData: any) => {
        let isValid = true
        if (!formData.accountNumber) {
            setAccountFormError('accountNumber', { type: 'required', message: 'Account number is required' })
            console.log('Account number is required')
            isValid = false
        }
        if (!formData.street) {
            setAccountFormError('street', { type: 'required', message: 'Street is required' })
            console.log('Street is required')
            isValid = false
        }
        if (!formData.city) {
            setAccountFormError('city', { type: 'required', message: 'City is required' })
            console.log('City is required')
            isValid = false
        }
        if (!formData.country) {
            setAccountFormError('country', { type: 'required', message: 'Country is required' })
            console.log('Country is required')
            isValid = false
        }
        if (formData.type === 'iban') {
            if (!formData.BIC) {
                setAccountFormError('BIC', { type: 'required', message: 'BIC is required' })
                console.log('BIC is required')
                isValid = false
            }
        } else if (formData.type === 'us') {
            if (!formData.routingNumber) {
                setAccountFormError('routingNumber', { type: 'required', message: 'Routing number is required' })
                console.log('Routing number is required')
                isValid = false
            }
        }

        return isValid
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

    const [tabIndex, setTabIndex] = useState(0)

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
                    {steps.map((step, index) => (
                        <Step key={index} className="gap-0">
                            <StepIndicator className="!mr-0">
                                <StepStatus complete={<StepIcon />} />
                            </StepIndicator>
                            <StepSeparator className="!ml-0 mr-2" />
                        </Step>
                    ))}
                </Stepper>
                {activeStep < steps.length ? (
                    <label className="text-h7">
                        Step {activeStep + 1}: <b>{steps[activeStep].title}</b>
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
                        disabled={activeStep === steps.length}
                    />
                    {errors.name && <span className="text-h9 font-normal text-red">{errors.name.message}</span>}

                    <input
                        {...registerOfframp('email', { required: 'This field is required' })}
                        className={`custom-input ${errors.email ? 'border border-red' : ''}`}
                        placeholder="Email"
                        type="email"
                        disabled={activeStep === steps.length}
                    />
                    {errors.email && <span className="text-h9 font-normal text-red">{errors.email.message}</span>}

                    <input
                        {...registerOfframp('recipient', { required: 'This field is required' })}
                        className={`custom-input ${errors.recipient ? 'border border-red' : ''}`}
                        placeholder="Iban"
                        disabled={activeStep === steps.length}
                    />
                    {errors.recipient && (
                        <span className="text-h9 font-normal text-red">{errors.recipient.message}</span>
                    )}
                </div>{' '}
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
                                placeholder="Street"
                            />
                            {accountErrors.street && (
                                <span className="text-h9 font-normal text-red">{accountErrors.street.message}</span>
                            )}

                            <input
                                {...registerAccount('city', {
                                    required: addressRequired ? 'This field is required' : false,
                                })}
                                className={`custom-input ${accountErrors.city ? 'border border-red' : ''}`}
                                placeholder="City"
                            />
                            {accountErrors.city && (
                                <span className="text-h9 font-normal text-red">{accountErrors.city.message}</span>
                            )}

                            <CountryDropdown
                                value={accountFormWatch('country')}
                                onChange={(value: any) => {
                                    setAccountFormValue('country', value, { shouldValidate: true })
                                    setAccountFormError('country', { message: undefined })
                                }}
                                error={accountErrors.country?.message}
                            />
                        </div>
                    </form>
                )}
                <div className="flex w-full flex-col items-center justify-center gap-2">
                    {activeStep === steps.length ? (
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
                    ) : activeStep === steps.length - 1 ? (
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

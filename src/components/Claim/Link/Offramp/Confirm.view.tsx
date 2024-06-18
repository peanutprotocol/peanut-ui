'use client'

import * as _consts from '../../Claim.consts'
import * as context from '@/context'
import { useContext, useState } from 'react'
import Loading from '@/components/Global/Loading'
import * as _interfaces from '../../Claim.interfaces'
import * as _utils from '../../Claim.utils'
import * as interfaces from '@/interfaces'

import { Step, StepIcon, StepIndicator, StepSeparator, StepStatus, Stepper, Stack, useSteps } from '@chakra-ui/react'
import { useForm } from 'react-hook-form'
import Icon from '@/components/Global/Icon'
import MoreInfo from '@/components/Global/MoreInfo'
import { v4 as uuidv4 } from 'uuid'

const steps = [
    { title: 'TOS', description: 'Agree to the tos', buttonText: 'Agree TOS' },
    { title: 'KYC', description: 'Complete KYC', buttonText: 'Complete KYC' },
    { title: 'Link Iban', description: 'Link iban to your account', buttonText: 'Link Iban' },
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
        register,
        handleSubmit,
        formState: { errors },
        watch,
    } = useForm({
        mode: 'onChange',
        defaultValues: offrampForm,
    })

    const [customerObject, setCustomerObject] = useState<interfaces.KYCData | null>(null)

    const onSubmit = async (inputFormData: _consts.IOfframpForm) => {
        setOfframpForm(inputFormData)

        try {
            // Step one: get the links to agree to (kyc and tos)
            setLoadingState('Getting KYC details')
            console.log('Getting KYC details...')

            const response = await fetch('/api/bridge/new-user/get-links', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'individual',
                    full_name: inputFormData.name,
                    email: inputFormData.email,
                }),
            })
            // const response = await fetch('https://api.bridge.xyz/v0/kyc_links', {
            //     method: 'POST',
            //     headers: {
            //         'Api-Key': process.env.BRIDGE_API_KEY!,
            //         'Idempotency-Key': '',
            //         accept: 'application/json',
            //         'content-type': 'application/json',
            //     },
            //     body: JSON.stringify({
            //         type: 'individual',
            //         full_name: inputFormData.name,
            //         email: inputFormData.email,
            //     }),
            // })

            if (!response.ok) {
                throw new Error('Failed to fetch KYC links')
            }

            const data = await response.json()
            setCustomerObject(data)
            console.log('KYC details fetched:', data)

            let { tos_status: tosStatus, kyc_status: kycStatus } = data

            // Fetch the initial TOS status
            // const tosResponse = await fetch('/api/bridge/new-user/get-status', {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //     },
            //     body: JSON.stringify({ userId: data.id, type: 'tos' }),
            // })

            // if (!tosResponse.ok) {
            //     throw new Error('Failed to fetch initial TOS status')
            // }

            // const tosData = await tosResponse.json()
            // tosStatus = tosData.tos_status
            // console.log('Initial TOS status:', tosStatus)

            // // Check TOS status and open link if not approved
            // if (tosStatus !== 'approved') {
            //     setLoadingState('Awaiting TOS confirmation')
            //     console.log('Awaiting TOS confirmation...')
            //     window.open(data.tos_link, '_blank')

            //     while (tosStatus !== 'approved') {
            //         const tosStatusResponse = await fetch('/api/bridge/new-user/get-status', {
            //             method: 'POST',
            //             headers: {
            //                 'Content-Type': 'application/json',
            //             },
            //             body: JSON.stringify({ userId: data.id, type: 'tos' }),
            //         })

            //         if (!tosStatusResponse.ok) {
            //             throw new Error('Failed to fetch TOS status')
            //         }

            //         const tosStatusData = await tosStatusResponse.json()
            //         tosStatus = tosStatusData.tos_status
            //         console.log('Current TOS status:', tosStatus)

            //         if (tosStatus !== 'approved') {
            //             await new Promise((resolve) => setTimeout(resolve, 5000)) // wait 5 seconds before checking again
            //         }
            //     }

            //     console.log('TOS confirmation complete.')
            //     handleOnNext()
            // } else {
            //     console.log('TOS already approved.')
            // }

            // // Fetch the initial KYC status
            // const kycResponse = await fetch('/api/bridge/new-user/get-status', {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //     },
            //     body: JSON.stringify({ userId: data.id, type: 'kyc' }),
            // })

            // if (!kycResponse.ok) {
            //     throw new Error('Failed to fetch initial KYC status')
            // }

            // const kycData = await kycResponse.json()
            // kycStatus = kycData.kyc_status
            // console.log('Initial KYC status:', kycStatus)

            // // Check KYC status and open link if not approved
            // if (kycStatus !== 'approved') {
            //     setLoadingState('Awaiting KYC confirmation')
            //     console.log('Awaiting KYC completion...')
            //     window.open(data.kyc_link, '_blank')

            //     while (kycStatus !== 'approved') {
            //         const kycStatusResponse = await fetch('/api/bridge/new-user/get-status', {
            //             method: 'POST',
            //             headers: {
            //                 'Content-Type': 'application/json',
            //             },
            //             body: JSON.stringify({ userId: data.id, type: 'kyc' }),
            //         })

            //         if (!kycStatusResponse.ok) {
            //             throw new Error('Failed to fetch KYC status')
            //         }

            //         const kycStatusData = await kycStatusResponse.json()
            //         kycStatus = kycStatusData.kyc_status
            //         console.log('Current KYC status:', kycStatus)

            //         if (kycStatus !== 'approved') {
            //             await new Promise((resolve) => setTimeout(resolve, 5000)) // wait 5 seconds before checking again
            //         }
            //     }

            //     console.log('KYC completion complete.')
            //     handleOnNext()
            // } else {
            //     console.log('KYC already approved.')
            // }

            // setLoadingState('Idle')
            // console.log('Process complete. Loading state set to idle.')
        } catch (error) {
            console.error('Error during the submission process:', error)
            setLoadingState('Idle')
        }
    }

    const handleOnNext = () => {
        if (activeStep === steps.length) {
            onNext()
        } else {
            goToNext()
        }
    }

    const handleOnPrev = () => {
        if (activeStep === 0) {
            onPrev()
        } else {
            goToPrevious()
        }
    }

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
            <form className="flex w-full flex-col items-center justify-center gap-6 " onSubmit={handleSubmit(onSubmit)}>
                <div className="flex w-full flex-col items-start justify-center gap-2">
                    <label>We need your details to send you your funds.</label>

                    <input
                        {...register('name', { required: 'This field is required' })}
                        className={`custom-input ${errors.name ? 'border border-red' : ''}`}
                        placeholder="Name"
                        disabled={activeStep === steps.length}
                    />
                    {errors.name && <span className="text-h9 font-normal text-red">{errors.name.message}</span>}

                    <input
                        {...register('email', { required: 'This field is required' })}
                        className={`custom-input ${errors.email ? 'border border-red' : ''}`}
                        placeholder="Email"
                        type="email"
                        disabled={activeStep === steps.length}
                    />
                    {errors.email && <span className="text-h9 font-normal text-red">{errors.email.message}</span>}

                    <input
                        {...register('recipient', { required: 'This field is required' })}
                        className={`custom-input ${errors.recipient ? 'border border-red' : ''}`}
                        placeholder="Iban"
                        disabled={activeStep === steps.length}
                    />
                    {errors.recipient && (
                        <span className="text-h9 font-normal text-red">{errors.recipient.message}</span>
                    )}
                </div>
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
                </div>
            </form>
        </div>
    )
}

export default ConfirmClaimLinkIbanView

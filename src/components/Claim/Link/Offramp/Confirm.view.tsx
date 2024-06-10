'use client'
import Icon from '@/components/Global/Icon'
import { useAccount } from 'wagmi'

import * as _consts from '../../Claim.consts'
import * as utils from '@/utils'
import useClaimLink from '../../useClaimLink'
import * as context from '@/context'
import { useContext, useEffect, useState } from 'react'
import Loading from '@/components/Global/Loading'
import MoreInfo from '@/components/Global/MoreInfo'
import * as _interfaces from '../../Claim.interfaces'
import * as _utils from '../../Claim.utils'
import * as consts from '@/constants'
import { useBalance } from '@/hooks/useBalance'

import {
    Step,
    StepDescription,
    StepIcon,
    StepIndicator,
    StepNumber,
    StepSeparator,
    StepStatus,
    StepTitle,
    Stepper,
    Box,
    useSteps,
    Progress,
    Stack,
    Text,
} from '@chakra-ui/react'
import { useForm } from 'react-hook-form'

const steps = [
    { title: 'TOS', description: 'Agree to the tos' },
    { title: 'KYC', description: 'Complete KYC' },
    { title: 'Link Iban', description: 'Link iban to your account' },
]

export const ConfirmClaimLinkIbanView = ({
    onPrev,

    recipient,
}: _consts.IClaimScreenProps) => {
    const { activeStep, goToNext, goToPrevious } = useSteps({
        index: 0,
        count: steps.length,
    })

    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })

    const inputForm = useForm({
        mode: 'onChange',
        defaultValues: {
            name: '',
            email: '',
            recipient: recipient,
        },
    })

    const handleSubmit = async () => {}
    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 px-2 text-center">
            <Stack w={'100%'} className="items-start">
                <Stepper
                    colorScheme={'purple'}
                    size="sm"
                    w={'100%'}
                    index={activeStep}
                    gap="0" // TODO: update colorScheme
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
                <Text>
                    Step {activeStep + 1}: <b>{steps[activeStep].title}</b>
                </Text>
            </Stack>
            <form
                className="flex w-full flex-col items-center justify-center gap-6 "
                onSubmit={inputForm.handleSubmit(handleSubmit)}
            >
                <div className="flex w-full flex-col items-start justify-center gap-2">
                    <label>We need your details to send you your funds.</label>

                    <input
                        {...inputForm.register('name', {
                            required: 'This field is required',
                        })}
                        className="custom-input"
                        placeholder="Name"
                    />
                    <input
                        className="custom-input"
                        {...inputForm.register('email', {
                            required: 'This field is required',
                        })}
                        placeholder="Email"
                    />
                    <input
                        className="custom-input"
                        {...inputForm.register('recipient', {
                            required: 'This field is required',
                        })}
                        placeholder="Iban"
                    />
                </div>
                <div>
                    <div className="flex w-full flex-col items-center justify-center gap-2">
                        {activeStep === 0 ? (
                            <label className="mb-2 w-full text-center text-h8 font-normal">
                                The KYC process is done through an external 3rd party. The Peanut App has no access to
                                your KYC details.
                            </label>
                        ) : (
                            <label className="mb-2 w-full text-center text-h8 font-normal">
                                The KYC process is done through an external 3rd party. The Peanut App has no access to
                                your KYC details.
                            </label>
                        )}

                        <button
                            className="btn-purple btn-xl"
                            // onClick={() => {
                            //     goToNext()
                            // }}
                            type="submit"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <div className="flex w-full flex-row items-center justify-center gap-2">
                                    <Loading /> {loadingState}
                                </div>
                            ) : (
                                'Claim'
                            )}
                        </button>
                        <button
                            className="btn btn-xl dark:border-white dark:text-white"
                            onClick={() => {
                                goToPrevious()
                            }}
                            disabled={isLoading}
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
            </form>
        </div>
    )
}

export default ConfirmClaimLinkIbanView

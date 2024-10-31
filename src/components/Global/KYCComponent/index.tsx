'use client'

import { useMemo, useState } from 'react'
import { Step, Steps, useSteps } from 'chakra-ui-steps'

import * as utils from '@/utils'
import * as interfaces from '@/interfaces'
import * as consts from '@/constants'
import IframeWrapper, { IFrameWrapperProps } from '../IframeWrapper'
import { useForm } from 'react-hook-form'
import { useAuth } from '@/context/authContext'
import Loading from '../Loading'
import { GlobalLoginComponent } from '../LoginComponent'
import { GlobalRegisterComponent } from '../RegisterComponent'
import { Divider } from '@chakra-ui/react'
import { CrispButton } from '@/components/CrispChat'

const steps = [
    { label: 'Step 1: Provide personal details' },
    { label: 'Step 2: Agree to TOS' },
    { label: 'Step 3: Complete KYC' },
]

interface IKYCComponentProps {
    intialStep: number
    offrampForm: consts.IOfframpForm
    setOfframpForm: (form: consts.IOfframpForm) => void
    onCompleted?: (message: string) => void
}

export const GlobalKYCComponent = ({ intialStep, offrampForm, setOfframpForm, onCompleted }: IKYCComponentProps) => {
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [iframeOptions, setIframeOptions] = useState<IFrameWrapperProps>({
        src: '',
        visible: false,
        onClose: () => {
            setIframeOptions({ ...iframeOptions, visible: false })
        },
    })
    const [customerObject, setCustomerObject] = useState<interfaces.KYCData | null>(null)
    const [tosLinkOpened, setTosLinkOpened] = useState<boolean>(false)
    const [kycLinkOpened, setKycLinkOpened] = useState<boolean>(false)

    const [loadingState, setLoadingState] = useState<string>('Idle')
    const isLoading = useMemo(() => loadingState !== 'Idle', [loadingState])
    const { fetchUser, updateBridgeCustomerId } = useAuth()

    const {
        setStep: setActiveStep,
        activeStep,
        nextStep: goToNext,
    } = useSteps({
        initialStep: intialStep,
    })

    const {
        watch: watchOfframp,
        formState: { errors },
        setValue: setOfframpFormValue,
    } = useForm<consts.IOfframpForm>({
        mode: 'onChange',
        defaultValues: offrampForm,
    })

    const handleEmail = async (inputFormData: consts.IOfframpForm) => {
        setOfframpForm(inputFormData)
        setActiveStep(0)
        setLoadingState('Getting profile')

        try {
            const _user = await fetchUser()

            setOfframpFormValue('recipient', inputFormData.recipient)
            setOfframpFormValue('name', _user?.user?.full_name ?? '')
            setOfframpFormValue('email', _user?.user?.email ?? '')

            if (_user?.user?.bridge_customer_id) {
                if (
                    _user?.accounts.find(
                        (account) =>
                            account.account_identifier.replaceAll(/\s/g, '').toLowerCase() ===
                            inputFormData.recipient.replaceAll(/\s/g, '').toLowerCase()
                    )
                ) {
                    setActiveStep(4)
                    onCompleted?.('account found')
                } else {
                    onCompleted?.('KYC completed')
                    setActiveStep(3)
                }
            } else {
                let data = await utils.getUserLinks(inputFormData)
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
                setActiveStep(3)
            }
        } catch (error: any) {
            console.error('Error during the submission process:', error)
            setErrorState({ showError: true, errorMessage: 'An error occurred. Please try again later' })
        } finally {
            setLoadingState('Idle')
        }
    }

    const handleTOSStatus = async () => {
        try {
            // Handle TOS status

            let _customerObject
            const _offrampForm = watchOfframp()

            // @ts-ignore
            if (!customerObject || customerObject.code === 'invalid_parameters') {
                _customerObject = await utils.getUserLinks(_offrampForm)
                setCustomerObject(_customerObject)
            } else {
                _customerObject = customerObject
            }

            const { tos_status: tosStatus, id, tos_link } = _customerObject

            if (tosStatus !== 'approved') {
                setLoadingState('Awaiting TOS confirmation')

                console.log('Awaiting TOS confirmation...')
                setIframeOptions({ ...iframeOptions, src: tos_link, visible: true })
                await utils.awaitStatusCompletion(
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
            let _customerObject
            const _offrampForm = watchOfframp()
            if (!customerObject) {
                _customerObject = await utils.getUserLinks(_offrampForm)
                setCustomerObject(_customerObject)
            } else {
                _customerObject = customerObject
            }
            const { kyc_status: kycStatus, id, kyc_link } = _customerObject
            if (kycStatus === 'under_review') {
                setErrorState({
                    showError: true,
                    errorMessage: 'KYC under review',
                })
                return
            } else if (kycStatus === 'rejected') {
                setErrorState({
                    showError: true,
                    errorMessage: 'KYC rejected',
                })
                return
            } else if (kycStatus !== 'approved') {
                setLoadingState('Awaiting KYC confirmation')
                console.log('Awaiting KYC confirmation...')
                const kyclink = utils.convertPersonaUrl(kyc_link)
                setIframeOptions({ ...iframeOptions, src: kyclink, visible: true, closeConfirmMessage: 'Are you sure ? your KYC progress will be lost.' })
                await utils.awaitStatusCompletion(
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
            const customer = await utils.getStatus(_customerObject.id, 'customer_id')
            setCustomerObject({ ..._customerObject, customer_id: customer.customer_id })

            // Update peanut user with bridge customer id
            const updatedUser = await updateBridgeCustomerId(customer.customer_id)

            // recipientType === 'us' && setAddressRequired(true)
            setLoadingState('Idle')
            await fetchUser()
            onCompleted?.('KYC completed')
        } catch (error) {
            console.error('Error during the submission process:', error)

            if (error instanceof Error) {
                // TODO: this is duplicate with the error message we show when reloading the page
                if (error.message === 'KYC_UNDER_REVIEW') {
                    setErrorState({
                        showError: true,
                        errorMessage: 'Your KYC is under manual review. Please contact support',
                    })
                    return
                }
            }

            setErrorState({ showError: true, errorMessage: 'An error occurred. Please try again later' })

            setLoadingState('Idle')
        } finally {
            setLoadingState('Idle')
        }
    }

    const [userState, setUserState] = useState<'login' | 'register'>('login')

    const renderComponent = () => {
        switch (activeStep) {
            case 0:
                return userState === 'login' ? (
                    <div className="flex w-full flex-col items-center justify-center gap-2">
                        <GlobalLoginComponent
                            onSubmit={({ status, message }) => {
                                if (status === 'success') {
                                    handleEmail(watchOfframp())
                                } else {
                                    setErrorState({
                                        showError: true,
                                        errorMessage: message,
                                    })
                                }
                            }}
                        />{' '}
                        <span className="flex w-full flex-row items-center justify-center gap-2">
                            <Divider borderColor={'black'} />
                            <p>or</p>
                            <Divider borderColor={'black'} />
                        </span>
                        <button
                            className="btn btn-xl h-8 text-h8"
                            onClick={() => {
                                setUserState('register')
                            }}
                        >
                            Register
                        </button>
                    </div>
                ) : (
                    <div className="flex w-full flex-col items-center justify-center gap-2">
                        <GlobalRegisterComponent
                            onSubmit={({ status, message }) => {
                                if (status === 'success') {
                                    handleEmail(watchOfframp())
                                } else {
                                    setErrorState({
                                        showError: true,
                                        errorMessage: message,
                                    })
                                }
                            }}
                        />
                        <span className="flex w-full flex-row items-center justify-center gap-2">
                            <Divider borderColor={'black'} />
                            <p>or</p>
                            <Divider borderColor={'black'} />
                        </span>
                        <button
                            className="btn btn-xl h-8 text-h8"
                            onClick={() => {
                                setUserState('login')
                            }}
                        >
                            Login
                        </button>
                    </div>
                )

            case 1:
                return (
                    <div className="mb-2 flex flex-col items-center justify-center gap-2">
                        <button
                            onClick={() => {
                                handleTOSStatus()
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
                                handleKYCStatus()
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
        }
    }

    return (
        <div>
            <div className="flex w-full flex-col items-center justify-center gap-6 px-2  text-center">
                <p className="w-full text-h8 font-normal">Regulations require us to verify your identity.</p>
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
                    className="w-full"
                >
                    {steps.map(({ label }, index) => (
                        <Step label={label} key={label}>
                            <div className="relative z-10 flex w-full items-center justify-center pr-[40px]">
                                {renderComponent()}
                            </div>
                        </Step>
                    ))}
                </Steps>

                <div className="flex w-full flex-col items-center justify-center gap-2">
                    {errorState.showError && errorState.errorMessage === 'KYC under review' ? (
                        <div className="text-center">
                            <label className=" text-h8 font-normal text-red ">
                                KYC is under manual review, we might need additional documents.{' '}
                                <CrispButton className="text-blue-600 underline">Chat with support</CrispButton> to
                                finish the process.
                            </label>
                        </div>
                    ) : errorState.errorMessage === 'KYC rejected' ? (
                        <div className="text-center">
                            <label className=" text-h8 font-normal text-red ">KYC has been rejected.</label>
                            <CrispButton className="text-blue-600 underline">Chat with support</CrispButton>
                        </div>
                    ) : (
                        <div className="text-center">
                            <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                        </div>
                    )}
                </div>
                <IframeWrapper
                    {...iframeOptions}
                />
            </div>
        </div>
    )
}

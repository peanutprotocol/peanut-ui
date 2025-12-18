'use client'
import { Button } from '@/components/0_Bruddle/Button'
import ErrorAlert from '@/components/Global/ErrorAlert'
import FileUploadInput from '@/components/Global/FileUploadInput'
import GeneralRecipientInput, { type GeneralRecipientUpdate } from '@/components/Global/GeneralRecipientInput'
import NavHeader from '@/components/Global/NavHeader'
import PeanutLoading from '@/components/Global/PeanutLoading'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import ValidationErrorView, { type ValidationErrorViewProps } from '@/components/Payment/Views/Error.validation.view'
import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import UserCard from '@/components/User/UserCard'
import { loadingStateContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useUserStore } from '@/redux/hooks'
import { type IAttachmentOptions } from '@/interfaces/attachment'
import { usersApi } from '@/services/users'
import { formatAmount } from '@/utils/general.utils'
import { printableUsdc } from '@/utils/balance.utils'
import { captureException } from '@sentry/nextjs'
import { useRouter } from 'next/navigation'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useUserInteractions } from '@/hooks/useUserInteractions'
import { useUserByUsername } from '@/hooks/useUserByUsername'

interface DirectRequestInitialViewProps {
    username: string
}

const DirectRequestInitialView = ({ username }: DirectRequestInitialViewProps) => {
    const router = useRouter()
    const { user: authUser } = useUserStore()
    const { balance, address } = useWallet()
    const [attachmentOptions, setAttachmentOptions] = useState<IAttachmentOptions>({
        message: undefined,
        fileUrl: undefined,
        rawFile: undefined,
    })
    const [currentInputValue, setCurrentInputValue] = useState<string>('')
    const [view, setView] = useState<'initial' | 'confirm' | 'success'>('initial')
    const { setLoadingState, loadingState } = useContext(loadingStateContext)
    const [recipient, setRecipient] = useState<{ name: string | undefined; address: string }>({
        address: '',
        name: '',
    })
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [validationError, setValidationError] = useState<ValidationErrorViewProps | null>(null)

    const {
        user: recipientUser,
        isLoading: isRecipientUserLoading,
        error: recipientUserError,
    } = useUserByUsername(username)

    const { interactions } = useUserInteractions(recipientUser ? [recipientUser.userId] : [])

    const resetRequestState = () => {
        setView('initial')
        setCurrentInputValue('')
        setAttachmentOptions({
            message: undefined,
            fileUrl: undefined,
            rawFile: undefined,
        })
    }

    const peanutWalletBalance = useMemo(() => {
        return balance !== undefined ? printableUsdc(balance) : ''
    }, [balance])

    const handleTokenValueChange = (value: string | undefined) => {
        setCurrentInputValue(value || '')
    }

    const isButtonDisabled = useMemo(() => {
        const parsedAmount = parseFloat(currentInputValue)
        const isAmountInvalid = isNaN(parsedAmount) || parsedAmount <= 0
        const isIdentityLogicMissing = !!authUser?.user.userId ? !address : !recipient.address
        return !recipientUser?.username || isAmountInvalid || isIdentityLogicMissing
    }, [recipientUser?.username, currentInputValue, address, recipient.address, authUser?.user.userId])

    const isButtonLoading = useContext(loadingStateContext).isLoading

    const createRequestCharge = useCallback(async () => {
        if (isButtonDisabled) {
            setErrorState({ showError: true, errorMessage: 'Username or amount is missing' })
            return
        }
        setLoadingState('Requesting')
        setErrorState({ showError: false, errorMessage: '' })
        try {
            // Determine the recipient address
            const toAddress = authUser?.user.userId ? address : recipient.address
            if (!toAddress) {
                throw new Error('No recipient address available')
            }

            await usersApi.requestByUsername({
                username: recipientUser!.username,
                amount: currentInputValue,
                toAddress,
                attachment: attachmentOptions,
            })
            setLoadingState('Idle')
            setView('success')
        } catch (error: any) {
            console.error('Error creating request charge:', error)
            captureException(error)
            setErrorState({ showError: true, errorMessage: error.message || 'Failed to create request.' })
            setLoadingState('Idle')
        }
    }, [
        isButtonDisabled,
        recipientUser?.username,
        currentInputValue,
        address,
        attachmentOptions,
        setLoadingState,
        authUser,
        recipient.address,
        setErrorState,
    ])

    useEffect(() => {
        if (isRecipientUserLoading || authUser === undefined) {
            return
        }

        const getValidationErrorObject = (
            title: 'Invalid Recipient' | 'Missing Recipient',
            specificMessage?: string
        ): ValidationErrorViewProps => {
            let message = specificMessage
            if (!message) {
                message =
                    title === 'Invalid Recipient'
                        ? 'The user you are trying to request from is not a valid Peanut user or does not exist. Please ensure you have the correct Peanut username.'
                        : 'No username provided in the URL. Please check the link and try again.'
            }
            return {
                title,
                message,
                buttonText: authUser?.user.userId ? 'Go to home' : 'Create your Peanut Wallet',
                redirectTo: authUser?.user.userId ? '/home' : '/setup',
            }
        }

        if (!username) {
            setValidationError(getValidationErrorObject('Missing Recipient'))
            return
        }

        if (recipientUserError || !recipientUser) {
            setValidationError(getValidationErrorObject('Invalid Recipient'))
            return
        }

        setValidationError(null)
    }, [username, authUser, recipientUser, recipientUserError, isRecipientUserLoading])

    if (isRecipientUserLoading || authUser === undefined) {
        return (
            <div className="flex min-h-[inherit] w-full items-center justify-center">
                <PeanutLoading />
            </div>
        )
    }

    if (validationError) {
        return (
            <div className="flex flex-col items-center justify-center gap-8">
                {!!authUser?.user.userId ? <NavHeader onPrev={() => router.back()} title="Request" /> : null}
                <div className="my-auto flex h-full w-full flex-col items-center justify-center space-y-4 md:w-6/12">
                    <ValidationErrorView {...validationError} />
                </div>
            </div>
        )
    }

    if (view === 'success') {
        if (!recipientUser) return null
        return (
            <div className="flex min-h-[inherit] flex-col justify-between gap-8">
                {!!authUser?.user.userId ? (
                    <NavHeader onPrev={() => resetRequestState()} title="Request" />
                ) : (
                    <div className="text-center text-xl font-extrabold md:hidden">Request</div>
                )}

                <div className="my-auto flex h-full flex-col justify-center space-y-4">
                    <PaymentSuccessView
                        user={recipientUser}
                        amount={formatAmount(currentInputValue)}
                        message={attachmentOptions.message}
                        type="REQUEST"
                        redirectTo="/request"
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            {!!authUser?.user.userId ? (
                <NavHeader onPrev={() => router.back()} title="Request" />
            ) : (
                <div className="text-center text-xl font-extrabold md:hidden">Request</div>
            )}

            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                <UserCard
                    type="request"
                    recipientType={'USERNAME'}
                    username={recipientUser?.username || username}
                    fullName={recipientUser?.fullName}
                    isVerified={recipientUser?.bridgeKycStatus === 'approved'}
                    haveSentMoneyToUser={recipientUser?.userId ? interactions[recipientUser.userId] || false : false}
                />

                <div className="space-y-4">
                    <TokenAmountInput
                        className="w-full"
                        tokenValue={currentInputValue}
                        setTokenValue={handleTokenValueChange}
                        onSubmit={() => setView('confirm')}
                        walletBalance={peanutWalletBalance}
                        hideCurrencyToggle
                    />

                    <FileUploadInput
                        placeholder="Comment"
                        attachmentOptions={attachmentOptions}
                        setAttachmentOptions={setAttachmentOptions}
                        className="h-11"
                    />
                    {!authUser?.user.userId && (
                        <GeneralRecipientInput
                            placeholder="Enter a username, an address or ENS"
                            recipient={recipient}
                            onUpdate={(update: GeneralRecipientUpdate) => {
                                setRecipient(update.recipient)
                                if (update.isChanging) {
                                    setErrorState({ showError: false, errorMessage: '' })
                                } else {
                                    if (!update.isValid && update.errorMessage) {
                                        setErrorState({ showError: true, errorMessage: update.errorMessage })
                                    } else {
                                        if (
                                            (update.isValid && update.recipient.address) ||
                                            (!update.isValid && !update.errorMessage)
                                        ) {
                                            setErrorState({ showError: false, errorMessage: '' })
                                        } else {
                                            setErrorState({
                                                showError: true,
                                                errorMessage: update.errorMessage || 'Validating recipient...',
                                            })
                                        }
                                    }
                                }
                            }}
                            showInfoText={false}
                        />
                    )}

                    {errorState.showError ? (
                        <Button
                            variant="purple"
                            shadowSize="4"
                            onClick={() => {
                                setRecipient({ address: '', name: '' })
                                setErrorState({ showError: false, errorMessage: '' })
                            }}
                            loading={isButtonLoading}
                            className="w-full"
                            icon="retry"
                        >
                            Reset
                        </Button>
                    ) : (
                        <Button
                            shadowSize="4"
                            onClick={createRequestCharge}
                            disabled={isButtonDisabled || isButtonLoading}
                            loading={isButtonLoading}
                            icon="arrow-down-left"
                            iconSize={12}
                        >
                            {isButtonLoading ? loadingState : 'Request'}
                        </Button>
                    )}

                    {errorState.errorMessage && <ErrorAlert description={errorState.errorMessage} />}
                </div>
            </div>
        </div>
    )
}

export default DirectRequestInitialView

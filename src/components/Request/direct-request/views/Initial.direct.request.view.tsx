'use client'
import { Button } from '@/components/0_Bruddle'
import ErrorAlert from '@/components/Global/ErrorAlert'
import FileUploadInput from '@/components/Global/FileUploadInput'
import GeneralRecipientInput, { GeneralRecipientUpdate } from '@/components/Global/GeneralRecipientInput'
import { ArrowDownLeftIcon } from '@/components/Global/Icons/arrow-down-left'
import NavHeader from '@/components/Global/NavHeader'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import DirectSuccessView from '@/components/Payment/Views/Status.payment.view'
import UserCard from '@/components/User/UserCard'
import { loadingStateContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { RecipientType } from '@/interfaces'
import { useUserStore } from '@/redux/hooks'
import { IAttachmentOptions } from '@/redux/types/send-flow.types'
import { ApiUser, usersApi } from '@/services/users'
import { formatAmount, printableUsdc } from '@/utils'
import { captureException } from '@sentry/nextjs'
import { useRouter } from 'next/navigation'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'

interface DirectRequestInitialViewProps {
    username: string
}

const DirectRequestInitialView = ({ username }: DirectRequestInitialViewProps) => {
    const router = useRouter()
    const { user: authUser } = useUserStore()
    const { balance, address } = useWallet()
    const [user, setUser] = useState<ApiUser | null>(null)
    const [attachmentOptions, setAttachmentOptions] = useState<IAttachmentOptions>({
        message: undefined,
        fileUrl: undefined,
        rawFile: undefined,
    })
    const [isValidRecipient, setIsValidRecipient] = useState(false)
    const [inputChanging, setInputChanging] = useState<boolean>(false)
    const [currentInputValue, setCurrentInputValue] = useState<string>('')
    const [view, setView] = useState<'initial' | 'confirm' | 'success'>('initial')
    const { setLoadingState, loadingState, isLoading } = useContext(loadingStateContext)
    const [recipient, setRecipient] = useState<{ name: string | undefined; address: string }>({
        address: '',
        name: '',
    })
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [recipientType, setRecipientType] = useState<RecipientType>('address')
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
        return printableUsdc(balance)
    }, [balance])

    const handleTokenValueChange = (value: string | undefined) => {
        setCurrentInputValue(value || '')
    }

    const isDisabled = useMemo(() => {
        return !user?.username || !currentInputValue || (!!authUser?.user.userId && !address) || !recipient.address
    }, [user?.username, currentInputValue, address, recipient.address, authUser?.user.userId])

    const createRequestCharge = useCallback(async () => {
        if (isDisabled) {
            throw new Error('Username or amount is missing')
        }
        setLoadingState('Requesting')
        try {
            await usersApi.requestByUsername({
                username: user!.username,
                amount: currentInputValue,
                toAddress: authUser?.user.userId ? address : recipient.address,
                attachment: attachmentOptions,
            })
            setLoadingState('Idle')
            setView('success')
        } catch (error) {
            console.error('Error creating request charge:', error)
            captureException(error)
            setLoadingState('Idle')
        }
    }, [isDisabled, user?.username, currentInputValue, address, attachmentOptions])

    useEffect(() => {
        async function fetchUser() {
            try {
                const response = await usersApi.getByUsername(username)
                setUser(response)
            } catch (error) {
                console.error(error)
            }
        }
        fetchUser()
    }, [username])

    if (view === 'success') {
        if (!user) return null
        return (
            <div className="flex min-h-[inherit] flex-col justify-between gap-8">
                {!!authUser?.user.userId ? (
                    <NavHeader onPrev={() => resetRequestState()} title="Request" />
                ) : (
                    <div className="text-center text-xl font-extrabold md:hidden">Request</div>
                )}

                <div className="my-auto flex h-full flex-col justify-center space-y-4">
                    <DirectSuccessView
                        user={user}
                        amount={formatAmount(currentInputValue)}
                        message={attachmentOptions.message}
                        type="REQUEST"
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            {!!authUser?.user.userId ? (
                <NavHeader onPrev={() => router.push('/request')} title="Request" />
            ) : (
                <div className="text-center text-xl font-extrabold md:hidden">Request</div>
            )}

            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                <UserCard type="request" username={user?.username || username} fullName={user?.fullName} />

                <div className="space-y-4">
                    <TokenAmountInput
                        className="w-full"
                        tokenValue={currentInputValue}
                        setTokenValue={handleTokenValueChange}
                        onSubmit={() => setView('confirm')}
                        walletBalance={peanutWalletBalance}
                    />

                    <FileUploadInput
                        attachmentOptions={attachmentOptions}
                        setAttachmentOptions={setAttachmentOptions}
                    />
                    {!authUser?.user.userId && (
                        <GeneralRecipientInput
                            placeholder="Enter an address or ENS"
                            recipient={recipient}
                            onUpdate={(update: GeneralRecipientUpdate) => {
                                setRecipient(update.recipient)
                                if (!update.recipient.address) {
                                    setRecipientType('address')
                                    setErrorState({
                                        showError: false,
                                        errorMessage: '',
                                    })
                                } else {
                                    setRecipientType(update.type)
                                }
                                setIsValidRecipient(update.isValid)
                                setErrorState({
                                    showError: !update.isValid,
                                    errorMessage: update.errorMessage,
                                })
                                setInputChanging(update.isChanging)
                            }}
                        />
                    )}

                    {errorState.errorMessage && <ErrorAlert description={errorState.errorMessage} />}

                    <Button
                        shadowSize="4"
                        onClick={createRequestCharge}
                        disabled={isDisabled || isLoading}
                        loading={isLoading}
                    >
                        <div className="flex size-6 items-center justify-center">
                            <ArrowDownLeftIcon />
                        </div>
                        {isLoading ? loadingState : 'Request'}
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default DirectRequestInitialView

'use client'
import { Button } from '@/components/0_Bruddle'
import FileUploadInput from '@/components/Global/FileUploadInput'
import { ArrowDownLeftIcon } from '@/components/Global/Icons/arrow-down-left'
import NavHeader from '@/components/Global/NavHeader'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import UserCard from '@/components/User/UserCard'
import { useWallet } from '@/hooks/wallet/useWallet'
import { IAttachmentOptions } from '@/redux/types/send-flow.types'
import { ApiUser, usersApi } from '@/services/users'
import { printableUsdc } from '@/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useCallback, useContext } from 'react'
import DirectRequestSuccessView from './Success.direct.request.view'
import { loadingStateContext } from '@/context'

interface DirectRequestInitialViewProps {
    username: string
}

const DirectRequestInitialView = ({ username }: DirectRequestInitialViewProps) => {
    const router = useRouter()
    const { balance, address } = useWallet()
    const [user, setUser] = useState<ApiUser | null>(null)
    const [attachmentOptions, setAttachmentOptions] = useState<IAttachmentOptions>({
        message: undefined,
        fileUrl: undefined,
        rawFile: undefined,
    })
    const [currentInputValue, setCurrentInputValue] = useState<string>('')
    const [view, setView] = useState<'initial' | 'confirm' | 'success'>('initial')
    const { setLoadingState, loadingState, isLoading } = useContext(loadingStateContext)

    const peanutWalletBalance = useMemo(() => {
        return printableUsdc(balance)
    }, [balance])

    const handleTokenValueChange = (value: string | undefined) => {
        setCurrentInputValue(value || '')
    }

    const isDisabled = useMemo(() => {
        return !user?.username || !currentInputValue || !address
    }, [user?.username, currentInputValue])

    const createRequestCharge = useCallback(async () => {
        if (isDisabled) {
            throw new Error('Username or amount is missing')
        }
        setLoadingState('Requesting')
        await usersApi.requestByUsername({
            username: user!.username,
            amount: currentInputValue,
            toAddress: address,
        })
        setLoadingState('Idle')
        setView('success')
    }, [isDisabled, user?.username, currentInputValue, address])

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

    if (!user) return null

    if (view === 'success') {
        return (
            <div className="space-y-8">
                <NavHeader onPrev={() => setView('confirm')} title="Request" />
                <DirectRequestSuccessView
                    user={user}
                    amount={currentInputValue}
                    message={attachmentOptions.message}
                    onBack={() => router.push('/request')}
                />
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <NavHeader onPrev={() => router.push('/request')} title="Request" />
            <div className="space-y-4">
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

                    <Button onClick={createRequestCharge} disabled={isDisabled || isLoading} loading={isLoading}>
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

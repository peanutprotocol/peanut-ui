'use client'
import { Button } from '@/components/0_Bruddle'
import FileUploadInput from '@/components/Global/FileUploadInput'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import UserCard from '@/components/User/UserCard'
import { useWallet } from '@/hooks/wallet/useWallet'
import { WalletProviderType } from '@/interfaces'
import { IAttachmentOptions } from '@/redux/types/send-flow.types'
import { ApiUser, usersApi } from '@/services/users'
import { printableUsdc } from '@/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import DirectRequestConfirmView from './Confirm.direct.request.view'
import DirectRequestSuccessView from './Success.direct.request.view'

interface DirectRequestInitialViewProps {
    username: string
}

const DirectRequestInitialView = ({ username }: DirectRequestInitialViewProps) => {
    const router = useRouter()
    const { wallets } = useWallet()
    const [user, setUser] = useState<ApiUser | null>(null)
    const [attachmentOptions, setAttachmentOptions] = useState<IAttachmentOptions>({
        message: undefined,
        fileUrl: undefined,
        rawFile: undefined,
    })
    const [currentInputValue, setCurrentInputValue] = useState<string>('')
    const [view, setView] = useState<'initial' | 'confirm' | 'success'>('initial')

    const peanutWallet = useMemo(
        () => wallets.find((wallet) => wallet.walletProviderType === WalletProviderType.PEANUT),
        [wallets]
    )
    const peanutWalletBalance = useMemo(() => {
        if (!peanutWallet?.balance) return undefined
        return printableUsdc(peanutWallet.balance)
    }, [peanutWallet?.balance])

    const handleTokenValueChange = (value: string | undefined) => {
        setCurrentInputValue(value || '')
    }

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

    if (view === 'confirm') {
        return (
            <div className="space-y-8">
                <NavHeader onPrev={() => setView('initial')} title="Request" />
                <DirectRequestConfirmView
                    user={user}
                    amount={currentInputValue}
                    attachmentOptions={attachmentOptions}
                    onConfirm={() => setView('success')}
                    walletBalance={peanutWalletBalance}
                />
            </div>
        )
    }

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

                    <Button onClick={() => setView('confirm')} disabled={!currentInputValue} shadowSize="4">
                        <div className="flex size-6 items-center justify-center">
                            <Icon name="arrow-down-left" size={20} />
                        </div>
                        Request
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default DirectRequestInitialView

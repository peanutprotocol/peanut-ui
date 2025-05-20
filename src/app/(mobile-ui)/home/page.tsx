'use client'

import { PeanutArmHoldingBeer } from '@/assets'
import { Button, ButtonSize, ButtonVariant } from '@/components/0_Bruddle'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import Loading from '@/components/Global/Loading'
import PeanutLoading from '@/components/Global/PeanutLoading'
import RewardsModal from '@/components/Global/RewardsModal'
import HomeHistory from '@/components/Home/HomeHistory'
import RewardsCardModal from '@/components/Home/RewardsCardModal'
import { SearchUsers } from '@/components/SearchUsers'
import { UserHeader } from '@/components/UserHeader'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useUserStore, useWalletStore } from '@/redux/hooks'
import { formatExtendedNumber, getUserPreferences, printableUsdc, updateUserPreferences } from '@/utils'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export default function Home() {
    const { balance, address, isFetchingBalance, isFetchingRewardBalance } = useWallet()
    const { rewardWalletBalance } = useWalletStore()
    const [isRewardsModalOpen, setIsRewardsModalOpen] = useState(false)
    const [isBalanceHidden, setIsBalanceHidden] = useState(() => {
        const prefs = getUserPreferences()
        return prefs?.balanceHidden ?? false
    })

    const { isFetchingUser, addAccount } = useAuth()
    const { user } = useUserStore()
    const username = user?.user.username

    const userFullName = useMemo(() => {
        if (!user) return
        return user.user.full_name
    }, [user])

    const handleToggleBalanceVisibility = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        setIsBalanceHidden((prev: boolean) => {
            const newValue = !prev
            updateUserPreferences({ balanceHidden: newValue })
            return newValue
        })
    }

    const isLoading = isFetchingUser && !username

    useEffect(() => {
        // We have some users that didn't have the peanut wallet created
        // correctly, so we need to create it
        if (address && user && !user.accounts.some((a) => a.account_type === 'peanut-wallet')) {
            addAccount({
                accountIdentifier: address,
                accountType: 'peanut-wallet',
                userId: user.user.userId,
            })
        }
    }, [user, address])

    if (isLoading) {
        return <PeanutLoading coverFullScreen />
    }

    return (
        <PageContainer>
            <div className="h-full w-full space-y-6 p-5">
                <div className="flex items-center justify-between gap-2">
                    <UserHeader
                        username={username!}
                        fullName={userFullName}
                        isVerified={user?.user.kycStatus === 'approved'}
                    />
                    <SearchUsers />
                </div>
                <div className="space-y-4">
                    <ActionButtonGroup>
                        <ActionButtonWithHref label="Add money" action="add" href="/add-money" size="small" />
                        <ActionButtonWithHref label="Withdraw" action="withdraw" href="/witdraw" size="small" />
                    </ActionButtonGroup>

                    <WalletBalance
                        balance={balance}
                        isBalanceHidden={isBalanceHidden}
                        onToggleBalanceVisibility={handleToggleBalanceVisibility}
                        isFetchingBalance={isFetchingBalance}
                    />

                    <ActionButtonGroup>
                        <ActionButtonWithHref label="Send" action="send" href="/send" variant="purple" size="large" />
                        <ActionButtonWithHref
                            label="Request"
                            action="request"
                            href="/request"
                            variant="purple"
                            size="large"
                        />
                    </ActionButtonGroup>
                </div>

                {/* Rewards Card - only shows if balance is non-zero */}
                <div onClick={() => setIsRewardsModalOpen(true)} className="cursor-pointer">
                    <RewardsCard
                        balance={Math.floor(Number(rewardWalletBalance) ?? 0).toString() ?? '0'}
                        isFetchingRewardBalance={isFetchingRewardBalance}
                    />
                </div>

                <HomeHistory username={username ?? undefined} />
                <RewardsModal />

                {/* Render the new Rewards Card Modal */}
                <RewardsCardModal visible={isRewardsModalOpen} onClose={() => setIsRewardsModalOpen(false)} />
            </div>
        </PageContainer>
    )
}

function WalletBalance({
    balance,
    isBalanceHidden,
    onToggleBalanceVisibility,
    isFetchingBalance,
}: {
    balance: bigint
    isBalanceHidden: boolean
    onToggleBalanceVisibility: (e: React.MouseEvent<HTMLButtonElement>) => void
    isFetchingBalance?: boolean
}) {
    const balanceDisplay = useMemo(() => {
        if (isBalanceHidden) {
            return (
                <span className="inline-flex items-center">
                    <span className="relative top-1">* * * *</span>
                </span>
            )
        }

        return formatExtendedNumber(printableUsdc(balance ?? 0))
    }, [isBalanceHidden, balance])

    return (
        <div className="flex items-center gap-2">
            <div className="flex items-end gap-2 text-4xl font-black leading-none sm:text-[2.5rem]">
                {isFetchingBalance ? (
                    <span className="block pl-3">
                        <Loading />
                    </span>
                ) : (
                    <>
                        <span className="text-xl">$ </span>
                        {balanceDisplay}
                    </>
                )}
            </div>

            {!isFetchingBalance && (
                <button onClick={onToggleBalanceVisibility}>
                    <Icon name={isBalanceHidden ? 'eye-slash' : 'eye'} className={'h-6 w-6'} fill={'black'} />
                </button>
            )}
        </div>
    )
}

interface ActionButtonProps {
    label: string
    action: 'add' | 'withdraw' | 'send' | 'request'
    href: string
    variant?: ButtonVariant
    size?: ButtonSize
}

function ActionButtonWithHref({ label, action, href, variant = 'primary-soft', size = 'small' }: ActionButtonProps) {
    return (
        <Link href={href} className="block">
            <ActionButton label={label} action={action} variant={variant} size={size} />
        </Link>
    )
}

function ActionButton({ label, action, variant = 'primary-soft', size = 'small' }: Omit<ActionButtonProps, 'href'>) {
    // get icon based on action type
    const renderIcon = (): React.ReactNode => {
        return (
            <div className="flex size-5 items-center justify-center">
                {(() => {
                    switch (action) {
                        case 'send':
                            return <Icon name="arrow-up-right" size={8} fill="currentColor" />
                        case 'withdraw':
                            return <Icon name="arrow-up" size={8} fill="currentColor" />
                        case 'add':
                            return <Icon name="arrow-down" size={8} fill="currentColor" />
                        case 'request':
                            return <Icon name="arrow-down-left" size={8} fill="currentColor" />
                        default:
                            return null
                    }
                })()}
            </div>
        )
    }
    return (
        <Button
            variant={variant}
            className={twMerge(
                'flex cursor-pointer items-center justify-center rounded-full',
                size === 'large' ? 'min-w-[145px] px-6 py-3' : 'min-w-[120px] px-4 py-2'
            )}
            shadowSize="4"
            size={size}
        >
            {renderIcon()}
            <span className={twMerge('font-bold', size === 'small' ? 'text-xs' : 'text-sm')}>{label}</span>
        </Button>
    )
}

function ActionButtonGroup({ children }: { children: React.ReactNode }) {
    return <div className="flex items-center justify-normal gap-4">{children}</div>
}

function RewardsCard({
    balance,
    isFetchingRewardBalance,
}: {
    balance: string | undefined
    isFetchingRewardBalance: boolean
}) {
    if (!balance || balance === '0') return null

    return (
        <div className="mt-6 space-y-3">
            <h2 className="font-bold">Rewards</h2>
            <Card position="single">
                <div className="flex w-full items-center justify-between font-roboto">
                    <div className="flex items-center gap-3">
                        <div
                            className={
                                'flex size-8 items-center justify-center rounded-full border border-black bg-white py-2.5 pl-3 pr-0.5'
                            }
                        >
                            <Image
                                src={PeanutArmHoldingBeer}
                                alt="Peanut arm holding beer"
                                className={twMerge('size-6 object-contain')}
                                width={24}
                                height={24}
                            />
                        </div>

                        <span className="text-sm font-medium">Beers</span>
                    </div>
                    <span className="text-sm font-medium">{isFetchingRewardBalance ? <Loading /> : balance}</span>
                </div>
            </Card>
        </div>
    )
}

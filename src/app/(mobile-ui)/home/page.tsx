'use client'

import { PeanutArmHoldingBeer } from '@/assets'
import { Button, ButtonSize, ButtonVariant } from '@/components/0_Bruddle'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import PeanutLoading from '@/components/Global/PeanutLoading'
import RewardsModal from '@/components/Global/RewardsModal'
import HomeHistory from '@/components/Home/HomeHistory'
import TransactionCard from '@/components/Home/TransactionCard'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { formatExtendedNumber, getUserPreferences, printableUsdc, updateUserPreferences } from '@/utils'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export default function Home() {
    const { peanutWalletDetails, getRewardWalletBalance } = useWallet()
    const [rewardsBalance, setRewardsBalance] = useState<string | undefined>(undefined)

    const [isBalanceHidden, setIsBalanceHidden] = useState(() => {
        const prefs = getUserPreferences()
        return prefs?.balanceHidden ?? false
    })

    const { username, isFetchingUser } = useAuth()

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
        const fetchRewardsBalance = async () => {
            try {
                const balance = await getRewardWalletBalance()
                setRewardsBalance(balance)
            } catch (error) {
                console.error('Failed to fetch rewards balance:', error)
            }
        }

        fetchRewardsBalance()
    }, [getRewardWalletBalance])

    if (isLoading) {
        return <PeanutLoading coverFullScreen />
    }

    return (
        <div className="h-full w-full p-5">
            <div className="space-y-4">
                <ActionButtonGroup>
                    <ActionButton label="Add money" action="add" href="/add" size="small" />
                    <ActionButton label="Withdraw" action="withdraw" href="/withdraw" size="small" />
                </ActionButtonGroup>

                <WalletBalance
                    balance={peanutWalletDetails?.balance ?? BigInt(0)}
                    isBalanceHidden={isBalanceHidden}
                    onToggleBalanceVisibility={handleToggleBalanceVisibility}
                />

                <ActionButtonGroup>
                    <ActionButton label="Send" action="send" href="/send" variant="purple" size="large" />
                    <ActionButton
                        label="Request"
                        action="request"
                        href="/request/create"
                        variant="purple"
                        size="large"
                    />
                </ActionButtonGroup>
            </div>

            {/* Rewards Card - only shows if balance is non-zero */}
            <RewardsCard balance={rewardsBalance} />

            {/* Transaction cards - temporary */}
            <div className="mt-6 space-y-3">
                <h2 className="font-bold">Transactions</h2>
                <div>
                    <TransactionCard
                        type="send"
                        name="Hugo Montenegro"
                        amount={BigInt(6969000000)}
                        status="completed"
                        initials="HM"
                        position="first"
                    />

                    <TransactionCard
                        type="withdraw"
                        name="Bank Account #1"
                        amount={BigInt(6969000000)}
                        status="completed"
                        position="middle"
                    />

                    <TransactionCard
                        type="add"
                        name="peanut.ens"
                        amount={BigInt(6969000000)}
                        status="completed"
                        position="middle"
                    />

                    <TransactionCard
                        type="request"
                        name="dasdasdasdsa Montenegro"
                        amount={BigInt(6969000000)}
                        status="pending"
                        initials="HM"
                        position="last"
                    />
                </div>
            </div>

            <HomeHistory />
            <RewardsModal />
        </div>
    )
}

function WalletBalance({
    balance,
    isBalanceHidden,
    onToggleBalanceVisibility,
}: {
    balance: bigint
    isBalanceHidden: boolean
    onToggleBalanceVisibility: (e: React.MouseEvent<HTMLButtonElement>) => void
}) {
    const balanceDisplay = useMemo(() => {
        if (isBalanceHidden) {
            return (
                <span className="inline-flex items-center">
                    <span className="relative top-1">* * * *</span>
                </span>
            )
        }

        return formatExtendedNumber(printableUsdc(balance))
    }, [isBalanceHidden, balance])

    return (
        <div className="flex items-center gap-2">
            <p className="flex items-end gap-2 text-4xl font-black leading-none sm:text-[2.5rem]">
                {' '}
                <span className="text-xl">$ </span>
                {balanceDisplay}
            </p>

            <button onClick={onToggleBalanceVisibility}>
                <Icon name={isBalanceHidden ? 'eye-slash' : 'eye'} className={'h-6 w-6'} fill={'black'} />
            </button>
        </div>
    )
}

function ActionButton({
    label,
    action,
    href,
    variant = 'primary-soft',
    size = 'small',
}: {
    label: string
    action: 'add' | 'withdraw' | 'send' | 'request'
    href: string
    variant?: ButtonVariant
    size?: ButtonSize
}) {
    // get icon based on action type
    const renderIcon = (): React.ReactNode => {
        return (
            <div className="flex size-5 items-center justify-center">
                {(() => {
                    switch (action) {
                        case 'send':
                            return <Icon name="arrow-up-right" size={8} fill="currentColor" />
                        case 'withdraw':
                            return <Icon name="arrow-down" size={8} fill="currentColor" />
                        case 'add':
                            return <Icon name="arrow-up" size={8} fill="currentColor" />
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
        <Link href={href} className="block">
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
        </Link>
    )
}

function ActionButtonGroup({ children }: { children: React.ReactNode }) {
    return <div className="flex items-center justify-normal gap-4">{children}</div>
}

function RewardsCard({ balance }: { balance: string | undefined }) {
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
                    <span className="text-sm font-medium">{balance}</span>
                </div>
            </Card>
        </div>
    )
}

'use client'

import { PeanutArmHoldingBeer } from '@/assets'
import { Button, ButtonSize, ButtonVariant } from '@/components/0_Bruddle'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import IOSInstallPWAModal from '@/components/Global/IOSInstallPWAModal'
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
import {
    formatExtendedNumber,
    getUserPreferences,
    printableUsdc,
    updateUserPreferences,
    getFromLocalStorage,
    saveToLocalStorage,
} from '@/utils'
import { useDisconnect } from '@reown/appkit/react'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useAccount } from 'wagmi'
import AddMoneyPromptModal from '@/components/Home/AddMoneyPromptModal'
import BalanceWarningModal from '@/components/Global/BalanceWarningModal'
import ReferralCampaignModal from '@/components/Home/ReferralCampaignModal'
import FloatingReferralButton from '@/components/Home/FloatingReferralButton'
import { AccountType } from '@/interfaces'
import { formatUnits } from 'viem'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'

const BALANCE_WARNING_THRESHOLD = parseInt(process.env.NEXT_PUBLIC_BALANCE_WARNING_THRESHOLD ?? '500')
const BALANCE_WARNING_EXPIRY = parseInt(process.env.NEXT_PUBLIC_BALANCE_WARNING_EXPIRY ?? '1814400') // 21 days in seconds

export default function Home() {
    const { balance, address, isFetchingBalance, isFetchingRewardBalance } = useWallet()
    const { rewardWalletBalance } = useWalletStore()
    const [isRewardsModalOpen, setIsRewardsModalOpen] = useState(false)
    const [isBalanceHidden, setIsBalanceHidden] = useState(() => {
        const prefs = getUserPreferences()
        return prefs?.balanceHidden ?? false
    })
    const { isConnected: isWagmiConnected } = useAccount()
    const { disconnect: disconnectWagmi } = useDisconnect()

    const { isFetchingUser, addAccount } = useAuth()
    const { user } = useUserStore()
    const username = user?.user.username

    const [showIOSPWAInstallModal, setShowIOSPWAInstallModal] = useState(false)
    const [showAddMoneyPromptModal, setShowAddMoneyPromptModal] = useState(false)
    const [showBalanceWarningModal, setShowBalanceWarningModal] = useState(false)
    const [showReferralCampaignModal, setShowReferralCampaignModal] = useState(false)

    const userFullName = useMemo(() => {
        if (!user) return
        return user.user.fullName
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
        if (address && user && !user.accounts.some((a) => a.type === AccountType.PEANUT_WALLET)) {
            addAccount({
                accountIdentifier: address,
                accountType: 'peanut-wallet',
                userId: user.user.userId,
            })
        }
    }, [user, address, addAccount])

    // always reset external wallet connection on home page
    useEffect(() => {
        if (isWagmiConnected) {
            disconnectWagmi()
        }
    }, [isWagmiConnected, disconnectWagmi])

    // effect for showing iOS PWA Install modal
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const isIOS =
                /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches
            const hasSeenModalThisSession = sessionStorage.getItem('hasSeenIOSPWAPromptThisSession')

            if (isIOS && !isStandalone && !hasSeenModalThisSession && !user?.hasPwaInstalled) {
                setShowIOSPWAInstallModal(true)
                sessionStorage.setItem('hasSeenIOSPWAPromptThisSession', 'true')
            } else {
                setShowIOSPWAInstallModal(false)
            }
        }
    }, [user?.hasPwaInstalled])

    // effect for showing balance warning modal
    useEffect(() => {
        if (typeof window !== 'undefined' && !isFetchingBalance) {
            const hasSeenBalanceWarning = getFromLocalStorage('hasSeenBalanceWarning')
            const balanceInUsd = Number(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS))

            // show if:
            // 1. balance is above the threshold
            // 2. user hasn't seen this warning in the current session
            // 3. no other modals are currently active
            if (
                balanceInUsd > BALANCE_WARNING_THRESHOLD &&
                !hasSeenBalanceWarning &&
                !showIOSPWAInstallModal &&
                !showAddMoneyPromptModal
            ) {
                setShowBalanceWarningModal(true)
            }
        }
    }, [balance, isFetchingBalance, showIOSPWAInstallModal, showAddMoneyPromptModal])

    // effect for showing add money prompt modal
    useEffect(() => {
        if (typeof window !== 'undefined' && !isFetchingBalance) {
            const hasSeenAddMoneyPromptThisSession = sessionStorage.getItem('hasSeenAddMoneyPromptThisSession')

            // show if:
            // 1. balance is zero.
            // 2. user hasn't seen this prompt in the current session.
            // 3. the iOS PWA install modal is not currently active.
            // 4. the balance warning modal is not currently active.
            // this allows the modal on any device (iOS/Android) and in any display mode (PWA/browser),
            // as long as the PWA modal (which is iOS & browser-specific) isn't taking precedence.
            if (
                balance === 0n &&
                !hasSeenAddMoneyPromptThisSession &&
                !showIOSPWAInstallModal &&
                !showBalanceWarningModal
            ) {
                setShowAddMoneyPromptModal(true)
                sessionStorage.setItem('hasSeenAddMoneyPromptThisSession', 'true')
            }
        }
    }, [balance, isFetchingBalance, showIOSPWAInstallModal, showBalanceWarningModal])

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
                        <ActionButtonWithHref label="Add" action="add" href="/add-money" size="small" />
                        <ActionButtonWithHref label="Withdraw" action="withdraw" href="/withdraw" size="small" />
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
            {/* iOS PWA Install Modal */}
            <IOSInstallPWAModal visible={showIOSPWAInstallModal} onClose={() => setShowIOSPWAInstallModal(false)} />

            {/* Add Money Prompt Modal */}
            <AddMoneyPromptModal visible={showAddMoneyPromptModal} onClose={() => setShowAddMoneyPromptModal(false)} />

            {/* Balance Warning Modal */}
            <BalanceWarningModal
                visible={showBalanceWarningModal}
                onCloseAction={() => {
                    setShowBalanceWarningModal(false)
                    saveToLocalStorage('hasSeenBalanceWarning', 'true', BALANCE_WARNING_EXPIRY)
                }}
            />

            {/* Referral Campaign Modal */}
            <ReferralCampaignModal
                visible={showReferralCampaignModal}
                onClose={() => setShowReferralCampaignModal(false)}
            />

            {/* Floating Referral Button */}
            <FloatingReferralButton onClick={() => setShowReferralCampaignModal(true)} />
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
                    <span className="relative top-1 text-[48px]">****</span>
                </span>
            )
        }

        return formatExtendedNumber(printableUsdc(balance ?? 0))
    }, [isBalanceHidden, balance])

    return (
        <div className="flex items-center gap-4">
            <div className="flex items-end gap-2 text-[48px] font-black leading-none md:text-[56px]">
                {isFetchingBalance ? (
                    <span className="block pl-3">
                        <Loading />
                    </span>
                ) : (
                    <>
                        <span className="text-[32px] md:text-[40px]">$ </span>
                        {balanceDisplay}
                    </>
                )}
            </div>

            {!isFetchingBalance && (
                <button onClick={onToggleBalanceVisibility}>
                    <Icon
                        name={isBalanceHidden ? 'eye-slash' : 'eye'}
                        className={'h-8 w-8 md:h-10 md:w-10'}
                        fill={'black'}
                    />
                </button> // no balance <> no icon
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
    const renderIcon = (): React.ReactNode => {
        return (
            <div
                className={twMerge(
                    'flex items-center justify-center',
                    size === 'small'
                        ? 'size-[22px] md:size-[23px]' // Add/Withdraw size
                        : 'size-[22px] md:size-[23px]' // Send/Request size
                )}
            >
                {(() => {
                    switch (action) {
                        case 'send':
                            return <Icon name="arrow-up-right" className="h-full w-full" fill="currentColor" />
                        case 'withdraw':
                            return <Icon name="arrow-up" className="h-full w-full" fill="currentColor" />
                        case 'add':
                            return <Icon name="arrow-down" className="h-full w-full" fill="currentColor" />
                        case 'request':
                            return <Icon name="arrow-down-left" className="h-full w-full" fill="currentColor" />
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
                'flex w-auto cursor-pointer items-center justify-center rounded-full',
                size === 'large'
                    ? 'h-12 gap-x-2 px-6 md:h-14 md:px-7' // Send/Request size
                    : 'h-10 gap-x-1 px-5 md:h-12 md:px-6' // Add/Withdraw size
            )}
            shadowSize="4"
            size={size}
        >
            {renderIcon()}
            <span
                className={twMerge(
                    'whitespace-nowrap font-semibold',
                    size === 'small'
                        ? 'text-sm md:text-base' // Add/Withdraw size
                        : 'text-base md:text-lg' // Send/Request size
                )}
            >
                {label}
            </span>
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

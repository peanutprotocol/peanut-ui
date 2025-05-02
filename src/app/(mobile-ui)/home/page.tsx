'use client'

import { PeanutArmHoldingBeer } from '@/assets'
import { Button, ButtonSize, ButtonVariant } from '@/components/0_Bruddle'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { useToast } from '@/components/0_Bruddle/Toast'
import AddFunds from '@/components/AddFunds'
import Card from '@/components/Global/Card'
import { EQrType, recognizeQr } from '@/components/Global/DirectSendQR/utils'
import { Icon } from '@/components/Global/Icons/Icon'
import PeanutLoading from '@/components/Global/PeanutLoading'
import QRScanner from '@/components/Global/QRScanner'
import RewardsModal from '@/components/Global/RewardsModal'
import HomeHistory from '@/components/Home/HomeHistory'
import RewardsCardModal from '@/components/Home/RewardsCardModal'
import { SearchUsers } from '@/components/SearchUsers'
import { UserHeader } from '@/components/UserHeader'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAppDispatch } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { formatExtendedNumber, getUserPreferences, printableUsdc, updateUserPreferences } from '@/utils'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export default function Home() {
    const { balance, getRewardWalletBalance } = useWallet()
    const [rewardsBalance, setRewardsBalance] = useState<string | undefined>(undefined)
    const [isRewardsModalOpen, setIsRewardsModalOpen] = useState(false)
    const [isQRScannerOpen, setIsQRScannerOpen] = useState(false)
    const router = useRouter()
    const dispatch = useAppDispatch()
    const toast = useToast()

    const [isBalanceHidden, setIsBalanceHidden] = useState(() => {
        const prefs = getUserPreferences()
        return prefs?.balanceHidden ?? false
    })

    const { username, isFetchingUser, user } = useAuth()

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
        const fetchRewardsBalance = async () => {
            try {
                const balance = await getRewardWalletBalance()
                setRewardsBalance(Math.floor(Number(balance || 0)).toString())
            } catch (error) {
                console.error('Failed to fetch rewards balance:', error)
            }
        }

        fetchRewardsBalance()
    }, [getRewardWalletBalance])

    const handleOpenCamera = () => {
        setIsRewardsModalOpen(false)
        setIsQRScannerOpen(true)
    }

    const handleScanRewardQR = async (data: string): Promise<{ success: boolean; error?: string }> => {
        dispatch(paymentActions.resetPaymentState())

        const qrType = recognizeQr(data.toLowerCase())

        if (qrType === EQrType.PINTA_MERCHANT) {
            const redirectUrl = `/${data}@polygon/PNT`
            console.log('Pinta merchant QR detected, redirecting to:', redirectUrl)
            router.push(redirectUrl)
            setIsQRScannerOpen(false)
            return { success: true }
        } else {
            console.warn('Scanned QR is not a Pinta merchant QR:', data, 'Type:', qrType)
            toast.error('Invalid QR code. Please scan the QR code provided by the bar.')
            return { success: false, error: 'QR not recognized as Pinta Merchant' }
        }
    }

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
                        <AddFunds cta={<ActionButton label="Add money" action="add" size="small" />} />
                        <ActionButtonWithHref label="Withdraw" action="withdraw" href="/cashout" size="small" />
                    </ActionButtonGroup>

                    <WalletBalance
                        balance={balance}
                        isBalanceHidden={isBalanceHidden}
                        onToggleBalanceVisibility={handleToggleBalanceVisibility}
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
                    <RewardsCard balance={rewardsBalance} />
                </div>

                <HomeHistory />
                <RewardsModal />

                {/* Render the new Rewards Card Modal */}
                <RewardsCardModal
                    visible={isRewardsModalOpen}
                    onClose={() => setIsRewardsModalOpen(false)}
                    onOpenCamera={handleOpenCamera}
                />

                {/* Render QR Scanner when needed */}
                {isQRScannerOpen && (
                    <QRScanner onScan={handleScanRewardQR} onClose={() => setIsQRScannerOpen(false)} isOpen={true} />
                )}
            </div>
        </PageContainer>
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

        return formatExtendedNumber(printableUsdc(balance ?? 0))
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

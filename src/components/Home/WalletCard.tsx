import { BG_WALLET_CARD_SVG, PeanutArmHoldingBeer } from '@/assets'
import PeanutWalletIcon from '@/assets/icons/small-peanut.png'
import { Card } from '@/components/0_Bruddle'
import Icon from '@/components/Global/Icon'
import { useWallet } from '@/hooks/wallet/useWallet'
import { IWallet, WalletProviderType } from '@/interfaces'
import { formatExtendedNumber, printableUsdc, shortenAddressLong } from '@/utils'
import { identicon } from '@dicebear/collection'
import { createAvatar } from '@dicebear/core'
import { usePrimaryName } from '@justaname.id/react'
import classNames from 'classnames'
import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import CopyToClipboard from '../Global/CopyToClipboard'

const WALLET_CARD_WIDTH = 'w-[300px]'
const WALLET_COLORS = ['bg-secondary-3', 'bg-secondary-1', 'bg-primary-1']
const ANIMATION_TRANSITION = { type: 'spring', stiffness: 300, damping: 20 }

type BaseWalletCardProps = {
    onClick?: () => void
    type: 'add' | 'wallet'
}

type WalletCardAdd = BaseWalletCardProps & {
    type: 'add'
}

type WalletCardWallet = BaseWalletCardProps & {
    type: 'wallet'
    wallet: IWallet
    username: string
    selected?: boolean
    isConnected?: boolean
    isUsable?: boolean
    isFocused?: boolean
    index: number
    isBalanceHidden: boolean
    onToggleBalanceVisibility: (e: React.MouseEvent<HTMLButtonElement>) => void
}

type WalletCardProps = WalletCardAdd | WalletCardWallet

export function WalletCard(props: WalletCardProps) {
    const { type, onClick } = props

    if (type === 'add') {
        return <AddWalletCard onClick={onClick} />
    }

    return <ExistingWalletCard {...(props as WalletCardWallet)} />
}

function AddWalletCard({ onClick }: { onClick?: () => void }) {
    return (
        <motion.div className="h-full">
            <Card
                className="h-full min-w-[300px] rounded-xl bg-purple-4/25 text-black hover:cursor-pointer"
                shadowSize="6"
                onClick={onClick}
            >
                <Card.Content className="flex h-full items-center justify-center gap-3">
                    <Icon name="plus-circle" className="h-6 w-6" />
                    <span className="text-base font-bold">Add wallet</span>
                </Card.Content>
            </Card>
        </motion.div>
    )
}

function ExistingWalletCard({
    wallet,
    username,
    index,
    isBalanceHidden,
    onToggleBalanceVisibility,
    isFocused,
    onClick,
}: WalletCardWallet) {
    const { isWalletConnected } = useWallet()
    const { primaryName } = usePrimaryName({
        address: wallet.address,
    })

    const isExternalWallet = wallet.walletProviderType !== WalletProviderType.PEANUT
    const isRewardsWallet = wallet.walletProviderType === WalletProviderType.REWARDS
    const isConnected = isWalletConnected(wallet)

    const backgroundColor = useMemo(() => {
        if (isExternalWallet && !isConnected) return 'bg-n-4'
        if (isRewardsWallet || wallet.walletProviderType === WalletProviderType.PEANUT) return 'bg-purple-4'
        return WALLET_COLORS[index % WALLET_COLORS.length]
    }, [index, isExternalWallet, isConnected, wallet.walletProviderType, isRewardsWallet])

    const walletImage = useMemo(() => {
        if (wallet.walletProviderType === WalletProviderType.PEANUT) {
            return PeanutWalletIcon
        }

        if (isRewardsWallet) {
            return PeanutArmHoldingBeer
        }

        const avatar = createAvatar(identicon, {
            seed: wallet.address,
            size: 128,
        }).toDataUri()

        return isConnected ? wallet.connector?.iconUrl || avatar : avatar
    }, [wallet, isConnected, isRewardsWallet])

    const cardOpacity = useMemo(() => {
        // Rewards wallet case, always available to select/focus
        if (isRewardsWallet) {
            return isFocused ? 'opacity-100' : 'opacity-80'
        }

        // External wallet cases
        if (isExternalWallet) {
            if (!isConnected) return 'opacity-50 transition-opacity duration-300' // Disconnected external wallet
            if (!isFocused) return 'opacity-70 transition-opacity duration-300' // Connected but not focused external wallet
        }

        return isFocused ? 'opacity-100 transition-opacity duration-300' : 'opacity-80 transition-opacity duration-300'
    }, [isExternalWallet, isConnected, isFocused, isRewardsWallet])

    const walletDisplayInfo = getWalletDisplayInfo(wallet, username, primaryName, isRewardsWallet)

    return (
        <motion.div
            className={classNames('mr-4 h-full', cardOpacity)}
            onClick={onClick}
            transition={ANIMATION_TRANSITION}
        >
            <Card
                className={classNames(
                    'relative flex h-full flex-col gap-4 rounded-xl text-white',
                    WALLET_CARD_WIDTH,
                    backgroundColor,
                    {
                        'cursor-pointer': true,
                        'text-gray-5 text-opacity-80': isExternalWallet && !isConnected && !isRewardsWallet,
                    }
                )}
                shadowSize="6"
            >
                <Image src={BG_WALLET_CARD_SVG} alt="" className="absolute z-1 h-full w-full" />
                <Card.Content className="z-10 flex h-full flex-col justify-normal gap-3 px-6 py-4">
                    {/* Header section */}
                    <div className="flex items-center justify-between">
                        <WalletAvatar image={walletImage} isRewardsWallet={isRewardsWallet} />
                        <WalletBadges
                            isExternalWallet={isExternalWallet}
                            isRewardsWallet={isRewardsWallet}
                            isConnected={isConnected}
                        />
                    </div>

                    {/* Balance section */}
                    <div className="flex items-center gap-3">
                        <WalletBalance
                            wallet={wallet}
                            isBalanceHidden={isBalanceHidden}
                            isRewardsWallet={isRewardsWallet}
                            isExternalWallet={isExternalWallet}
                            isConnected={isConnected}
                            onToggleBalanceVisibility={onToggleBalanceVisibility}
                        />
                    </div>

                    {/* Footer section */}
                    <div className="relative flex items-center justify-between">
                        <WalletIdentifier
                            displayName={walletDisplayInfo.displayName}
                            isRewardsWallet={isRewardsWallet}
                        />
                        <div onClick={(e) => e.stopPropagation()}>
                            <CopyToClipboard textToCopy={walletDisplayInfo.copyText} />
                        </div>
                    </div>
                </Card.Content>
            </Card>
        </motion.div>
    )
}

function WalletAvatar({ image, isRewardsWallet }: { image: string; isRewardsWallet: boolean }) {
    return (
        <div
            className={twMerge(
                isRewardsWallet ? 'p-1' : 'p-2',
                'flex size-8 items-center justify-center rounded-full bg-white'
            )}
        >
            <Image src={image} alt="Wallet avatar" className="size-6 object-contain" width={24} height={24} />
        </div>
    )
}

function WalletBadges({
    isExternalWallet,
    isRewardsWallet,
    isConnected,
}: {
    isExternalWallet: boolean
    isRewardsWallet: boolean
    isConnected: boolean
}) {
    if (isRewardsWallet) {
        return <div className="rounded-sm bg-white/75 px-2 py-1 text-xs font-bold text-success-1">Crecimiento</div>
    }

    if (isExternalWallet) {
        return (
            <div className="flex items-center gap-2">
                <div className="rounded-sm bg-white/75 px-2 py-1 text-xs font-bold text-grey-1">External</div>
                <div
                    className={classNames('rounded-sm bg-white/75 px-2 py-1 text-xs font-bold', {
                        'text-success-1': isConnected,
                        'text-gray-5': !isConnected,
                    })}
                >
                    {isConnected ? 'Connected' : 'Disconnected'}
                </div>
            </div>
        )
    }

    return null
}

function WalletBalance({
    wallet,
    isBalanceHidden,
    isRewardsWallet,
    isExternalWallet,
    isConnected,
    onToggleBalanceVisibility,
}: {
    wallet: IWallet
    isBalanceHidden: boolean
    isRewardsWallet: boolean
    isExternalWallet: boolean
    isConnected: boolean
    onToggleBalanceVisibility: (e: React.MouseEvent<HTMLButtonElement>) => void
}) {
    let balanceDisplay = null

    if (isRewardsWallet) {
        // TODO: Replace with actual value from backend
        balanceDisplay = '5 Beers'
    } else if (isBalanceHidden) {
        balanceDisplay = (
            <span className="inline-flex items-center">
                <span className="relative top-1">* * * *</span>
            </span>
        )
    } else {
        balanceDisplay = `$ ${formatExtendedNumber(printableUsdc(wallet.balance))}`
    }

    return (
        <>
            <p className="min-w-28 text-4xl font-black leading-none sm:text-[2.5rem]">{balanceDisplay}</p>

            {!isRewardsWallet && (
                <button onClick={onToggleBalanceVisibility}>
                    <Icon
                        name={isBalanceHidden ? 'eye-slash' : 'eye'}
                        className={classNames('h-6 w-6', {
                            'opacity-80': isExternalWallet && !isConnected,
                        })}
                        fill={isExternalWallet && !isConnected ? 'bg-gray-5' : 'white'}
                    />
                </button>
            )}
        </>
    )
}

function WalletIdentifier({
    displayName,
    isRewardsWallet,
}: {
    displayName: React.ReactNode
    isRewardsWallet: boolean
}) {
    if (isRewardsWallet) {
        return (
            <p>
                Claim at{' '}
                <Link href={'#'} rel="noreferrer noopenner" className="underline" target="_blank">
                    partners bars
                </Link>
            </p>
        )
    }

    return <p className="truncate text-xl font-black sm:text-2xl">{displayName}</p>
}

function getWalletDisplayInfo(
    wallet: IWallet,
    username: string,
    primaryName: string | null | undefined,
    isRewardsWallet: boolean
) {
    if (isRewardsWallet) {
        return {
            displayName: 'Rewards',
            copyText: wallet.address,
        }
    }

    if (wallet.walletProviderType === WalletProviderType.PEANUT) {
        return {
            displayName: (
                <>
                    peanut.me/<span className="font-bold">{username}</span>
                </>
            ),
            copyText: `peanut.me/${username}`,
        }
    }

    return {
        displayName: primaryName || shortenAddressLong(wallet.address),
        copyText: primaryName || wallet.address,
    }
}

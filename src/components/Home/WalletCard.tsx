import { BG_WALLET_CARD_SVG } from '@/assets'
import PeanutWalletIcon from '@/assets/icons/small-peanut.png'
import { Card } from '@/components/0_Bruddle'
import Icon from '@/components/Global/Icon'
import { useWallet } from '@/hooks/wallet/useWallet'
import { IWallet, WalletProviderType } from '@/interfaces'
import { printableUsdc, shortenAddressLong } from '@/utils'
import { identicon } from '@dicebear/collection'
import { createAvatar } from '@dicebear/core'
import classNames from 'classnames'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { useMemo } from 'react'
import CopyToClipboard from '../Global/CopyToClipboard'

const colorArray = ['bg-secondary-3', 'bg-secondary-1', 'bg-primary-1']

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

export function WalletCard({ type, onClick, ...props }: WalletCardProps) {
    const { isWalletConnected } = useWallet()

    if (type === 'add') {
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

    const { wallet, username, index, isBalanceHidden, onToggleBalanceVisibility, isFocused } = props as WalletCardWallet

    const isExternalWallet = wallet.walletProviderType !== WalletProviderType.PEANUT
    const isConnected = isWalletConnected(wallet)

    const backgroundColor = useMemo(() => {
        if (isExternalWallet && !isConnected) return 'bg-n-4'
        if (wallet.walletProviderType === WalletProviderType.PEANUT) return 'bg-purple-4'
        return colorArray[index % colorArray.length]
    }, [index, isExternalWallet, isConnected, wallet.walletProviderType])

    const getWalletImage = useMemo(() => {
        if (wallet.walletProviderType === WalletProviderType.PEANUT) {
            return PeanutWalletIcon
        }
        return (
            wallet.connector?.iconUrl ||
            createAvatar(identicon, {
                seed: wallet.address,
                size: 128,
            }).toDataUri()
        )
    }, [wallet])

    const cardOpacity = useMemo(() => {
        // External wallet cases
        if (isExternalWallet) {
            if (!isConnected) {
                return 'opacity-50 transition-opacity duration-300' // Disconnected external wallet
            }
            if (!isFocused) {
                return 'opacity-70 transition-opacity duration-300' // Connected but not focused external wallet
            }
        }

        // Non-external wallets or focused external wallets
        if (!isFocused) {
            return 'opacity-80 transition-opacity duration-300' // Not focused wallets
        }

        return 'opacity-100 transition-opacity duration-300' // Focused wallet
    }, [isExternalWallet, isConnected, isFocused])

    return (
        <motion.div
            className={classNames('mr-4 h-full', cardOpacity)}
            onClick={onClick}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
            <Card
                className={classNames(
                    'relative flex h-full w-[300px] flex-col gap-4 rounded-xl text-white',
                    backgroundColor,
                    {
                        'cursor-pointer': true,
                        'text-gray-5 text-opacity-80': isExternalWallet && !isConnected,
                    }
                )}
                shadowSize="6"
            >
                <Image src={BG_WALLET_CARD_SVG} alt="" className="absolute z-1 h-full w-full" />
                <Card.Content className="z-10 flex h-full flex-col justify-normal gap-3 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex size-8 items-center justify-center rounded-full bg-white p-2">
                            <Image
                                src={getWalletImage}
                                alt={wallet.address || 'Wallet avatar'}
                                className="size-6 object-contain"
                                width={24}
                                height={24}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            {isExternalWallet && (
                                <>
                                    <div className="text-grey-1 rounded-sm bg-white/75 px-2 py-1 text-xs font-bold">
                                        External
                                    </div>
                                    <div
                                        className={classNames('rounded-sm bg-white/75 px-2 py-1 text-xs font-bold', {
                                            'text-success-1': isConnected,
                                            'text-gray-5': !isConnected,
                                        })}
                                    >
                                        {isConnected ? 'Connected' : 'Disconnected'}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <p className="min-w-28 text-4xl font-black leading-none sm:text-5xl">
                            {isBalanceHidden ? (
                                <span className="inline-flex items-center">
                                    <span className="relative top-1">* * * *</span>
                                </span>
                            ) : (
                                `$ ${printableUsdc(wallet.balance)}`
                            )}
                        </p>
                        <button onClick={onToggleBalanceVisibility}>
                            <Icon
                                name={isBalanceHidden ? 'eye-slash' : 'eye'}
                                className={classNames('h-6 w-6', {
                                    'opacity-80': isExternalWallet && !isConnected,
                                })}
                                fill={isExternalWallet && !isConnected ? 'bg-gray-5' : 'white'}
                            />
                        </button>
                    </div>

                    <div className="relative flex items-center justify-between">
                        {wallet.walletProviderType === WalletProviderType.PEANUT ? (
                            <p className="text-md">
                                peanut.me/<span className="font-bold">{username}</span>
                            </p>
                        ) : (
                            <p className="text-xl font-black sm:text-2xl">{shortenAddressLong(wallet.address)}</p>
                        )}

                        <div onClick={(e) => e.stopPropagation()}>
                            <CopyToClipboard
                                textToCopy={
                                    wallet.walletProviderType === WalletProviderType.PEANUT
                                        ? `peanut.me/${username}`
                                        : wallet.address
                                }
                            />
                        </div>
                    </div>
                </Card.Content>
            </Card>
        </motion.div>
    )
}

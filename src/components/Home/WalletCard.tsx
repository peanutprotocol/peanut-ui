import { BG_WALLET_CARD_SVG } from '@/assets'
import PeanutWalletIcon from '@/assets/icons/small-peanut.png'
import { Card } from '@/components/0_Bruddle'
import Icon from '@/components/Global/Icon'
import { IWallet, WalletProviderType } from '@/interfaces'
import { printableUsdc, shortenAddressLong } from '@/utils'
import classNames from 'classnames'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { useMemo } from 'react'
import CopyToClipboard from '../Global/CopyToClipboard'

// convert the color map to an array for easy indexing
const colorArray = ['#90A8ED', '#E99898', '#FFC900', '#98E9AB']

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
    index: number
    isBalanceHidden: boolean
    onToggleBalanceVisibility: (e: React.MouseEvent<HTMLButtonElement>) => void
}

type WalletCardProps = WalletCardAdd | WalletCardWallet

export function WalletCard({ type, onClick, ...props }: WalletCardProps) {
    if (type === 'add') {
        return (
            <motion.div className="h-full">
                <Card
                    className="bg-purple-4/20 h-full min-w-[300px] rounded-xl text-black hover:cursor-pointer"
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

    const {
        wallet,
        username,
        selected = false,
        index,
        isBalanceHidden,
        onToggleBalanceVisibility,
    } = props as WalletCardWallet

    // get color based on the wallet index, cycle through colors
    const backgroundColor = useMemo(() => colorArray[index % colorArray.length], [index])

    const getWalletImage = useMemo(() => {
        if (wallet.walletProviderType === WalletProviderType.PEANUT) {
            return PeanutWalletIcon
        }
        return wallet.walletIcon || PeanutWalletIcon
    }, [wallet])

    return (
        <motion.div
            className={classNames('mr-4 h-full', {
                'opacity-40': !selected,
            })}
            onClick={onClick}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
            <Card
                className={classNames(
                    'relative flex h-full w-[300px] flex-col gap-4 rounded-xl text-white hover:cursor-pointer'
                )}
                style={{
                    backgroundColor,
                }}
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
                        {wallet.walletProviderType !== WalletProviderType.PEANUT && (
                            <div className="rounded-md bg-white/75 px-2 py-1 text-xs font-bold text-gray-1">
                                External
                            </div>
                        )}
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
                            <Icon name={isBalanceHidden ? 'eye-slash' : 'eye'} className="h-6 w-6" fill="white" />
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

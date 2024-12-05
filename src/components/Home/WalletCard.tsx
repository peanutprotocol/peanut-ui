import { MouseEvent } from 'react'
import { Card } from '@/components/0_Bruddle'
import Image from 'next/image'
import { motion } from 'framer-motion'
import classNames from 'classnames'
import PeanutWalletIcon from '@/assets/icons/peanut-wallet.png'
import Icon from '@/components/Global/Icon'
import { shortenAddressLong, printableUsdc } from '@/utils'
import { IWallet } from '@/interfaces'

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
}

type WalletCardProps = WalletCardAdd | WalletCardWallet

export function WalletCard({ type, onClick, ...props }: WalletCardProps) {
    if (type === 'add') {
        return (
            <motion.div className="h-full">
                <Card
                    className="h-full min-w-[300px] rounded-md text-black hover:cursor-pointer"
                    shadowSize="6"
                    onClick={onClick}
                >
                    <Card.Content className="flex h-full flex-col items-center justify-center gap-6 p-6">
                        <p className="text-center text-xl font-bold">Add your own ETH wallet</p>
                        <div className="flex flex-row items-center gap-3">
                            <Icon name="plus-circle" className="h-6 w-6" />
                            <span className="text-base">Add BYOW wallet</span>
                        </div>
                    </Card.Content>
                </Card>
            </motion.div>
        )
    }

    const { wallet, username, selected = false } = props as WalletCardWallet

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
                    'flex h-full w-[300px] flex-col gap-4 rounded-md text-white hover:cursor-pointer',
                    {
                        'bg-green-1': wallet.connected,
                        'bg-purple-1': !wallet.connected,
                    }
                )}
                shadowSize="6"
            >
                <Card.Content className="flex h-full flex-col justify-between gap-2">
                    <div className="flex flex-row items-center gap-4">
                        <Image src={PeanutWalletIcon} alt="" />
                        <p className="text-md">
                            peanut.me/<span className="font-bold">{username}</span>
                        </p>
                    </div>
                    <p className="text-4xl font-black sm:text-5xl">$ {printableUsdc(wallet.balance)}</p>
                    <div className="relative">
                        <div className="flex flex-col">
                            <p className="text-xl font-black sm:text-2xl">{shortenAddressLong(wallet.address)}</p>
                        </div>
                        <Icon
                            name="content-copy"
                            className="absolute bottom-0 right-0 h-5 w-5 hover:opacity-80"
                            fill="white"
                            onClick={(e: MouseEvent<SVGElement>) => {
                                e.stopPropagation()
                                navigator.clipboard.writeText(wallet.address)
                            }}
                        />
                    </div>
                </Card.Content>
            </Card>
        </motion.div>
    )
}

'use client'

import { Wallet_ICON } from '@/assets'
import PeanutWalletIcon from '@/assets/icons/small-peanut.png'
import { Button, Card } from '@/components/0_Bruddle'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/context/walletContext'
import { IWallet, WalletProviderType } from '@/interfaces'
import { printableUsdc, shortenAddressLong } from '@/utils'
import { useAppKit } from '@reown/appkit/react'
import Image from 'next/image'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useAccount } from 'wagmi'
import CopyToClipboard from '../CopyToClipboard'
import Icon from '../Icon'
import Modal from '../Modal'

interface WalletHeaderProps {
    className?: HTMLDivElement['className']
    disabled?: boolean
}
interface WalletEntryCardProps {
    wallet: IWallet
    isActive?: boolean
    onClick?: () => void
}

const WalletHeader = ({ className, disabled }: WalletHeaderProps) => {
    const [showModal, setShowModal] = useState(false)
    const { wallets, selectedWallet, setSelectedWallet, isConnected } = useWallet()
    const { open: openWeb3Modal } = useAppKit()
    const { connector } = useAccount()

    // sort wallets to add active wallet at the top
    const sortedWallets = useMemo(() => {
        return [...wallets].sort((a, b) => {
            if (a.address === selectedWallet?.address) return -1
            if (b.address === selectedWallet?.address) return 1
            return 0
        })
    }, [wallets, selectedWallet])

    // handle wallet selection and close modal
    const handleWalletSelection = (wallet: IWallet) => {
        setSelectedWallet(wallet)
        setShowModal(false)
    }

    return (
        <div className={className}>
            {/* wallet selector button with current wallet info */}
            <Button
                disabled={disabled}
                variant="yellow"
                className={twMerge(
                    'flex h-auto w-fit min-w-32 items-center justify-between bg-yellow-4/80 py-2',
                    className
                )}
                onClick={() => setShowModal(true)}
            >
                {/* wallet icon container */}
                <div className="flex size-7 items-center justify-center rounded-full border border-n-1 bg-white p-2">
                    <Image src={PeanutWalletIcon} alt="" width={24} height={24} className="size-6 object-contain" />
                </div>

                {isConnected ? (
                    <span>
                        {selectedWallet?.walletProviderType === WalletProviderType.PEANUT
                            ? 'Peanut'
                            : connector?.name || shortenAddressLong(selectedWallet?.address)}
                    </span>
                ) : (
                    'Connect Wallet'
                )}
                <button className="ml-2.5 flex size-7 items-center justify-center rounded-full border border-n-1 bg-white p-0.5">
                    <Icon name="arrow-down-filled" fill="black" className="h-4" />
                </button>
            </Button>

            {/* wallet selection modal */}
            <Modal
                visible={showModal}
                onClose={() => setShowModal(false)}
                className="w-full items-center"
                classWrap="bg-background rounded-none border-0 p-6 pt-14 w-full max-h-[65vh] md:max-h-full overflow-y-auto"
            >
                <div className="space-y-7">
                    {/* modal header */}
                    <div className="flex items-center justify-between">
                        <div className="text-2xl font-black">Wallets</div>
                        <Button size="small" variant="yellow" className="w-fit bg-yellow-4/80 bg-opacity-20">
                            <Image src={Wallet_ICON} alt="" width={24} height={24} className="size-6 object-contain" />
                            <span>Manage wallet</span>
                        </Button>
                    </div>
                    {/* list connected wallets */}
                    <div className="space-y-2.5">
                        {sortedWallets.map((wallet) => (
                            <WalletEntryCard
                                key={wallet.address}
                                wallet={wallet}
                                isActive={wallet.address === selectedWallet?.address}
                                onClick={() => handleWalletSelection(wallet)}
                            />
                        ))}
                        <AddNewWallet onClick={openWeb3Modal} />
                    </div>
                </div>
            </Modal>
        </div>
    )
}

// individual wallet card component
const WalletEntryCard = ({ wallet, isActive, onClick }: WalletEntryCardProps) => {
    const { connector } = useAccount()
    const { username } = useAuth()
    const isPeanutWallet = wallet.walletProviderType === WalletProviderType.PEANUT

    // get wallet icon to display
    const walletImage = useMemo(() => {
        return isPeanutWallet ? PeanutWalletIcon : connector?.icon || PeanutWalletIcon
    }, [isPeanutWallet, connector])

    return (
        <Card onClick={onClick}>
            <Card.Content
                className={twMerge(
                    'flex w-full cursor-pointer items-center gap-3 px-4 py-3',
                    // highlight active wallet with different background
                    isActive ? 'bg-purple-1 hover:bg-purple-1/90' : 'bg-purple-4 bg-opacity-25 hover:bg-opacity-20'
                )}
            >
                {/* wallet icon */}
                <div className="flex size-12 min-w-12 items-center justify-center rounded-full border border-n-1 bg-white p-2">
                    <Image src={walletImage} alt="" width={32} height={32} className="size-7 object-contain" />
                </div>
                {/* wallet details section */}
                <div className="w-full space-y-1">
                    <div className="flex w-full items-center justify-between">
                        <p className="text-base font-bold">
                            {isPeanutWallet ? 'Peanut' : connector?.name || shortenAddressLong(wallet.address)}
                        </p>
                        <p className="text-base font-bold">$ {printableUsdc(wallet.balance)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isPeanutWallet && username ? (
                            <p className="text-xs font-medium">
                                peanut.me/<span className="font-black">{username}</span>
                            </p>
                        ) : (
                            <p className="text-xs font-medium">{shortenAddressLong(wallet.address)}</p>
                        )}
                        <CopyToClipboard
                            className="h-4 w-4"
                            fill="black"
                            textToCopy={isPeanutWallet && username ? `https://peanut.me/${username}` : wallet.address}
                        />
                    </div>
                </div>
            </Card.Content>
        </Card>
    )
}

// add new wallet component, triggers web3modal
const AddNewWallet = ({ onClick }: { onClick: () => void }) => (
    <Card onClick={onClick}>
        <Card.Content className="flex min-h-16 w-full cursor-pointer items-center justify-center gap-3 bg-purple-4 bg-opacity-25 px-4 py-3 hover:bg-opacity-20">
            <div className="flex size-7 items-center justify-center rounded-full border border-n-1">
                <Icon name="plus" fill="black" className="h-7 w-7" />
            </div>
            <span className="font-bold">Add wallet</span>
        </Card.Content>
    </Card>
)

export default WalletHeader

'use client'

import PeanutWalletIcon from '@/assets/icons/small-peanut.png'
import { Button, Card } from '@/components/0_Bruddle'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useWalletConnection } from '@/hooks/wallet/useWalletConnection'
import { IDBWallet, IWallet, WalletProviderType } from '@/interfaces'
import { printableUsdc, shortenAddressLong } from '@/utils'
import classNames from 'classnames'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import CopyToClipboard from '../CopyToClipboard'
import Icon from '../Icon'
import Modal from '../Modal'
import { usePrimaryName } from '@justaname.id/react'

interface WalletHeaderProps {
    className?: HTMLDivElement['className']
    disabled?: boolean
    isConnected?: boolean
    isUsable?: boolean
}
interface WalletEntryCardProps {
    wallet: IWallet
    isActive?: boolean
    onClick: () => void
    isConnected?: boolean
    isUsable?: boolean
}

const WalletHeader = ({ className, disabled }: WalletHeaderProps) => {
    const [showModal, setShowModal] = useState(false)
    const { wallets, setSelectedWallet, selectedWallet, isConnected, isWalletConnected } = useWallet()
    const { connectWallet } = useWalletConnection()

    const sortedWallets = useMemo(() => {
        return [...wallets].filter((account) => Object.values(WalletProviderType).includes(account.walletProviderType))
    }, [wallets, selectedWallet])

    // handle wallet selection and close modal
    const handleWalletSelection = (wallet: IWallet) => {
        // only set selected wallet if it's a Peanut wallet or a connected external wallet
        if (wallet && (wallet.walletProviderType === WalletProviderType.PEANUT || isWalletConnected(wallet))) {
            setSelectedWallet(wallet)
        }
    }

    // set selected wallet to peanut wallet if no external wallet is connected or selected
    useEffect(() => {
        const connectedExternalWallet = sortedWallets.find(
            (wallet) => wallet.walletProviderType !== WalletProviderType.PEANUT && isWalletConnected(wallet)
        )

        const isPeanutWalletSelected = selectedWallet?.walletProviderType === WalletProviderType.PEANUT
        const isExternalWalletSelectedAndConnected =
            selectedWallet?.walletProviderType !== WalletProviderType.PEANUT &&
            isWalletConnected(selectedWallet as IDBWallet)

        // if no wallet is selected or current selection is invalid
        if (!selectedWallet || (!isPeanutWalletSelected && !isExternalWalletSelectedAndConnected)) {
            if (connectedExternalWallet) {
                setSelectedWallet(connectedExternalWallet as IWallet)
            } else {
                // fallback to Peanut wallet
                const peanutWallet = sortedWallets.find(
                    (wallet) => wallet.walletProviderType === WalletProviderType.PEANUT
                )
                if (peanutWallet) {
                    setSelectedWallet(peanutWallet as IWallet)
                }
            }
        }
    }, [sortedWallets, isWalletConnected, setSelectedWallet, selectedWallet])

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
                    <Image
                        src={selectedWallet?.connector?.iconUrl || PeanutWalletIcon}
                        alt=""
                        width={24}
                        height={24}
                        className="size-6 object-contain"
                    />
                </div>

                {isConnected ? (
                    <span>
                        {selectedWallet?.walletProviderType === WalletProviderType.PEANUT
                            ? 'Peanut'
                            : selectedWallet?.connector?.name || shortenAddressLong(selectedWallet?.address)}
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
                classWrap="bg-background rounded-none border-0 p-6 w-full max-h-[65vh] md:max-h-full overflow-y-auto"
            >
                <div className="space-y-7">
                    {/* modal header */}
                    <div className="absolute top-3 flex items-center justify-between">
                        <div className="text-2xl font-black">Wallets</div>
                        {/* todo: re-add this when wallet management is implemented */}
                        {/* <Button size="small" variant="yellow" className="w-fit bg-yellow-4/80 bg-opacity-20">
                            <Image src={Wallet_ICON} alt="" width={24} height={24} className="size-6 object-contain" />
                            <span>Manage wallet</span>
                        </Button> */}
                    </div>
                    {/* list connected wallets */}
                    <div className="space-y-2.5 pt-4">
                        {sortedWallets.map((wallet) => (
                            <WalletEntryCard
                                key={wallet.address}
                                wallet={wallet}
                                isActive={wallet.address === selectedWallet?.address}
                                onClick={() => handleWalletSelection(wallet)}
                            />
                        ))}
                        <AddNewWallet onClick={connectWallet} />
                    </div>
                </div>
            </Modal>
        </div>
    )
}

// individual wallet card component
const WalletEntryCard = ({ wallet, isActive, onClick }: WalletEntryCardProps) => {
    const { username } = useAuth()
    const { isWalletConnected } = useWallet()
    const { connectWallet, connectionStatus } = useWalletConnection()

    const isExternalWallet = useMemo(() => wallet.walletProviderType !== WalletProviderType.PEANUT, [wallet])
    const isPeanutWallet = useMemo(() => wallet.walletProviderType === WalletProviderType.PEANUT, [wallet])
    const isConnected = isWalletConnected(wallet)

    const handleAction = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (isExternalWallet && !isConnected) {
            await connectWallet()
        }
    }

    // get wallet icon to display
    const walletImage = useMemo(() => {
        if (isPeanutWallet) {
            return PeanutWalletIcon
        }
        return isConnected ? wallet.connector?.iconUrl || PeanutWalletIcon : PeanutWalletIcon
    }, [wallet, isConnected])

    // get background color
    const backgroundColor = useMemo(() => {
        if ((isPeanutWallet || isExternalWallet) && isConnected) {
            return isActive ? 'bg-primary-1 hover:bg-primary-1/90' : 'bg-purple-4 bg-opacity-25 hover:bg-opacity-20'
        }
        if (isExternalWallet && !isConnected) return 'bg-n-4'
    }, [isExternalWallet, isConnected, isActive, isPeanutWallet, wallet.address])

    const { primaryName } = usePrimaryName({
        address: wallet.address,
    })

    return (
        <Card onClick={onClick}>
            <Card.Content
                className={twMerge(
                    'flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-black transition-all duration-300',
                    backgroundColor,
                    isExternalWallet && !isConnected && 'text-gray-5'
                )}
            >
                {/* wallet icon */}
                <div className="flex size-12 min-w-12 items-center justify-center rounded-full border border-n-1 bg-white p-2">
                    <Image src={walletImage} alt="" width={32} height={32} className="size-7 object-contain" />
                </div>

                {/* wallet details section */}
                <div className="flex w-full flex-col gap-1">
                    <div className="flex w-full items-center justify-between">
                        <div className="flex items-center gap-2">
                            <p className="text-base font-bold">
                                {isPeanutWallet
                                    ? 'Peanut'
                                    : wallet?.connector?.name || shortenAddressLong(wallet.address)}
                            </p>
                        </div>
                        <p className="text-base font-bold">${printableUsdc(wallet.balance)}</p>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            {isPeanutWallet && username ? (
                                <p className="text-xs font-medium">
                                    peanut.me/<span className="font-black">{username}</span>
                                </p>
                            ) : (
                                <p className="text-xs font-medium">
                                    {primaryName || shortenAddressLong(wallet.address)}
                                </p>
                            )}
                            <CopyToClipboard
                                className="h-4 w-4"
                                fill={'black'}
                                textToCopy={
                                    isPeanutWallet && username
                                        ? `https://peanut.me/${username}`
                                        : primaryName || wallet.address
                                }
                            />
                        </div>
                        {isConnected && (
                            <div
                                className={classNames('w-20 rounded-sm bg-white/75 px-2 py-1 text-xs font-bold', {
                                    'text-success-1': isConnected,
                                })}
                            >
                                Connected
                            </div>
                        )}

                        {isExternalWallet && !isConnected && (
                            <button
                                onClick={handleAction}
                                disabled={connectionStatus === 'connecting'}
                                className={classNames(
                                    'minw w-20 rounded-sm px-2 py-1 text-xs font-bold text-black',
                                    connectionStatus === 'connecting' ? 'bg-purple-1/50' : 'bg-purple-1'
                                )}
                            >
                                {connectionStatus === 'connecting' ? 'Connecting...' : 'Connect'}
                            </button>
                        )}
                    </div>
                </div>
            </Card.Content>
        </Card>
    )
}

// add new wallet component, triggers web3modal
const AddNewWallet = ({ onClick }: { onClick: () => void }) => (
    <Card onClick={onClick}>
        <Card.Content className="flex min-h-16 w-full cursor-pointer items-center justify-center gap-3 bg-purple-5 px-4 py-3 hover:bg-opacity-90">
            <div className="flex size-7 items-center justify-center rounded-full border border-n-1">
                <Icon name="plus" fill="black" className="h-7 w-7" />
            </div>
            <span className="font-bold">Add wallet</span>
        </Card.Content>
    </Card>
)

export default WalletHeader

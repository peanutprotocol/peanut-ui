'use client'

import PeanutWalletIcon from '@/assets/icons/small-peanut.png'
import { Button, Card } from '@/components/0_Bruddle'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useWalletConnection } from '@/hooks/wallet/useWalletConnection'
import { IDBWallet, IWallet, WalletProviderType } from '@/interfaces'
import { printableUsdc, shortenAddressLong } from '@/utils'
import { usePrimaryName } from '@justaname.id/react'
import Image, { StaticImageData } from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import CopyToClipboard from '../CopyToClipboard'
import Icon from '../Icon'
import Modal from '../Modal'

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

interface WalletIconContainerProps {
    src: string | StaticImageData
    size?: number
    containerSize?: number
    className?: string
}

interface ModalHeaderProps {
    title: string
    description: string
}

interface ModalActionsProps {
    onCancel: () => void
    onAccept: () => void
    isConnecting: boolean
}

interface ConfirmationModalProps {
    wallet: IWallet
    showModal: boolean
    setShowModal: (showModal: boolean) => void
    onAccept: () => void
}

// common Components
const WalletIconContainer: React.FC<WalletIconContainerProps> = ({
    src,
    size = 6,
    containerSize = 7,
    className = '',
}) => (
    <div
        className={twMerge(
            `flex size-${containerSize} items-center justify-center rounded-full border border-n-1 bg-white p-2`,
            className
        )}
    >
        <Image src={src} alt="" width={24} height={24} className={`size-${size} object-contain`} />
    </div>
)

const ConnectionStatusDot: React.FC<{ isConnected: boolean }> = ({ isConnected }) => (
    <div className={twMerge(isConnected ? 'bg-success-1' : 'bg-gray-2', 'size-2 rounded-full')} />
)

// modal components
const ModalHeader: React.FC<ModalHeaderProps> = ({ title, description }) => (
    <div className="flex items-start gap-2">
        <WalletIconContainer src={PeanutWalletIcon} />
        <div className="space-y-1">
            <h1 className="text-lg font-bold">{title}</h1>
            <p className="text-sm font-medium">{description}</p>
        </div>
    </div>
)

const InfoBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex w-full items-start justify-center gap-2 border border-black bg-purple-5 p-4">
        <Icon name="info" fill="black" className="h-4 w-4" />
        <div className="text-xs">{children}</div>
    </div>
)

const ModalActions: React.FC<ModalActionsProps> = ({ onCancel, onAccept, isConnecting }) => (
    <div className="flex items-center justify-between gap-6">
        <Button
            size="medium"
            onClick={onCancel}
            variant="stroke"
            className="bg-purple-5 text-black hover:bg-purple-5/80 hover:text-black active:bg-purple-5/80"
        >
            Cancel
        </Button>
        <Button size="medium" onClick={onAccept} variant="purple" disabled={isConnecting}>
            {isConnecting ? 'Connecting...' : 'Accept'}
        </Button>
    </div>
)

const WalletHeader = ({ className, disabled }: WalletHeaderProps) => {
    const [showModal, setShowModal] = useState(false)
    const { wallets, setSelectedWallet, selectedWallet, isConnected, isWalletConnected, isPeanutWallet } = useWallet()
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
                <WalletIconContainer
                    src={isPeanutWallet ? PeanutWalletIcon : selectedWallet?.connector?.iconUrl || PeanutWalletIcon}
                />

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
const WalletEntryCard: React.FC<WalletEntryCardProps> = ({ wallet, isActive, onClick }) => {
    const { username } = useAuth()
    const { isWalletConnected } = useWallet()
    const [showConfirmationModal, setShowConfirmationModal] = useState(false)

    const isExternalWallet = useMemo(() => wallet.walletProviderType !== WalletProviderType.PEANUT, [wallet])
    const isPeanutWallet = useMemo(() => wallet.walletProviderType === WalletProviderType.PEANUT, [wallet])
    const isConnected = isWalletConnected(wallet)

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

    const handleCardClick = () => {
        if (isExternalWallet && !isConnected) {
            setShowConfirmationModal(true)
        } else {
            onClick()
        }
    }

    const WalletStatus: React.FC = () => (
        <div className="flex items-center gap-2">
            <ConnectionStatusDot isConnected={isConnected} />
            <p className="text-xs font-medium">
                {isPeanutWallet
                    ? 'Always ready to use'
                    : isExternalWallet && isConnected
                      ? 'Connected & Ready to sign'
                      : 'Not connected'}
            </p>
        </div>
    )

    return (
        <Card onClick={handleCardClick}>
            <Card.Content
                className={twMerge(
                    'flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-black transition-all duration-300',
                    backgroundColor,
                    isExternalWallet && !isConnected && 'text-gray-5'
                )}
            >
                <WalletIconContainer src={walletImage} size={7} containerSize={12} className="min-w-12" />
                {/* wallet details section */}
                <div className="flex w-full flex-col gap-1">
                    <div className="flex w-full items-center justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                {isPeanutWallet && username ? (
                                    <p className="text-base font-bold">Peanut Wallet</p>
                                ) : (
                                    <p className="text-base font-bold">
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
                            <WalletStatus />
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <p className="text-base font-bold">${printableUsdc(wallet.balance)}</p>
                        </div>
                    </div>
                </div>
            </Card.Content>
            <ConfirmationModal
                wallet={wallet}
                showModal={showConfirmationModal}
                setShowModal={setShowConfirmationModal}
                onAccept={onClick}
            />
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

const ConfirmationModal = ({ wallet, showModal, setShowModal, onAccept }: ConfirmationModalProps) => {
    const { connectWallet, connectionStatus } = useWalletConnection()

    const handleAccept = async () => {
        await connectWallet()
        onAccept()
        setShowModal(false)
    }

    return (
        <Modal
            visible={showModal}
            onClose={() => setShowModal(false)}
            className="w-full items-center"
            classWrap="bg-background rounded-none border-0 p-6 w-full max-h-[65vh] md:max-h-full overflow-y-auto"
        >
            <div className="space-y-4">
                <div className="space-y-3">
                    <ModalHeader
                        title={`Connect to ${shortenAddressLong(wallet.address)}?`}
                        description="This will disconnect any other external wallet currently connected."
                    />
                    <InfoBox>
                        <span className="font-bold">Important:</span> Make sure the account you want to connect is
                        selected in your external wallet.
                    </InfoBox>
                </div>
                <ModalActions
                    onCancel={() => setShowModal(false)}
                    onAccept={handleAccept}
                    isConnecting={connectionStatus === 'connecting'}
                />
            </div>
        </Modal>
    )
}

export default WalletHeader

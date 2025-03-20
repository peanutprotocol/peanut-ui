'use client'

import { PeanutArmHoldingBeer, PEANUTMAN_LOGO } from '@/assets'
import PeanutWalletIcon from '@/assets/icons/small-peanut.png'
import { Button, Card } from '@/components/0_Bruddle'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useWalletConnection } from '@/hooks/wallet/useWalletConnection'
import { IDBWallet, IWallet, WalletProviderType } from '@/interfaces'
import { useAppDispatch, useWalletStore } from '@/redux/hooks'
import { walletActions } from '@/redux/slices/wallet-slice'
import { printableUsdc, shortenAddressLong } from '@/utils'
import { truncateString } from '@/utils/format.utils'
import { identicon } from '@dicebear/collection'
import { createAvatar } from '@dicebear/core'
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
    hideRewardsWallet?: boolean
}

interface WalletEntryCardProps {
    wallet: IWallet
    isActive?: boolean
    onClick: () => void
    hasConnectedExternalWallets: boolean
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
    wallet: IWallet | null
}

interface ModalActionsProps {
    onAccept: () => void
    isConnecting: boolean
}

interface ConfirmationModalProps {
    wallet: IWallet | null
    showModal: boolean
    setShowModal: (showModal: boolean) => void
    onAccept: () => void
    isAddWallet?: boolean
}

interface AddNewWalletProps {
    onClick: () => void
    hasExternalWallets: boolean
    hasConnectedExternalWallets: boolean
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
const ModalHeader: React.FC<ModalHeaderProps> = ({ title, description, wallet }) => (
    <div className="flex items-start gap-2">
        <WalletIconContainer src={getWalletIcon(wallet, false, false)} />
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

const ModalActions: React.FC<ModalActionsProps> = ({ onAccept, isConnecting }) => (
    <Button size="medium" onClick={onAccept} variant="purple" disabled={isConnecting}>
        {isConnecting ? 'Connecting...' : 'Accept'}
    </Button>
)

const getWalletIcon = (wallet: IWallet | null, isPeanutWallet: boolean, isRewardsWallet: boolean) => {
    if (isPeanutWallet || !wallet) {
        return PeanutWalletIcon
    }

    if (isRewardsWallet) {
        return PeanutArmHoldingBeer
    }

    if (wallet.connector?.iconUrl) {
        return wallet.connector.iconUrl
    }

    return createAvatar(identicon, {
        seed: wallet.address,
        size: 128,
    }).toDataUri()
}

const WalletHeader = ({ className, disabled, hideRewardsWallet = false }: WalletHeaderProps) => {
    const [showModal, setShowModal] = useState(false)
    const { wallets, selectedWallet, isConnected, isWalletConnected, isPeanutWallet } = useWallet()
    const { connectWallet } = useWalletConnection()
    const dispatch = useAppDispatch()
    const [isInitializing, setIsInitializing] = useState(true)

    const sortedWallets = useMemo(() => {
        return [...wallets].filter((account) => {
            // hide rewards wallet if hideRewardsWallet is true
            if (hideRewardsWallet && account.walletProviderType === WalletProviderType.REWARDS) {
                return false
            }
            return Object.values(WalletProviderType).includes(account.walletProviderType)
        })
    }, [wallets, selectedWallet, hideRewardsWallet])

    const hasExternalWallets = useMemo(() => {
        return sortedWallets.some((wallet) => wallet.walletProviderType !== WalletProviderType.PEANUT)
    }, [sortedWallets])

    const hasConnectedExternalWallets = useMemo(() => {
        return (
            sortedWallets.length > 0 &&
            sortedWallets.some(
                (wallet) =>
                    wallet.walletProviderType === WalletProviderType.BYOW && isWalletConnected(wallet as IDBWallet)
            )
        )
    }, [sortedWallets, isWalletConnected])

    // handle wallet selection and close modal
    const handleWalletSelection = (wallet: IWallet) => {
        // only set selected wallet if it's a Peanut wallet, rewards wallet, or a connected external wallet
        if (
            wallet &&
            (wallet.id.startsWith('peanut-wallet') ||
                wallet.id === 'pinta-wallet' ||
                (wallet.walletProviderType === WalletProviderType.BYOW && isWalletConnected(wallet)))
        ) {
            dispatch(walletActions.setSelectedWalletId(wallet.id))
            setShowModal(false)
        }
    }

    // set selected wallet to peanut wallet if no external wallet is connected or selected
    useEffect(() => {
        const connectedExternalWallet = sortedWallets.find(
            (wallet) => wallet.walletProviderType === WalletProviderType.BYOW && isWalletConnected(wallet)
        )

        // check if current selection is valid
        const isValidSelection =
            selectedWallet &&
            ((selectedWallet.id.startsWith('peanut-wallet') &&
                selectedWallet.walletProviderType === WalletProviderType.PEANUT) ||
                (selectedWallet.id === 'pinta-wallet' &&
                    selectedWallet.walletProviderType === WalletProviderType.REWARDS) ||
                (selectedWallet.walletProviderType === WalletProviderType.BYOW && isWalletConnected(selectedWallet)))

        // if no wallet is selected or current selection is invalid
        if (!selectedWallet || !isValidSelection) {
            if (connectedExternalWallet) {
                dispatch(walletActions.setSelectedWalletId(connectedExternalWallet.id))
            } else {
                // fallback to Peanut wallet
                const peanutWallet = sortedWallets.find(
                    (wallet) =>
                        wallet.id.startsWith('peanut-wallet') && wallet.walletProviderType === WalletProviderType.PEANUT
                )
                if (peanutWallet) {
                    dispatch(walletActions.setSelectedWalletId(peanutWallet.id))
                }
            }
        }
        setIsInitializing(false)
    }, [sortedWallets, isWalletConnected, dispatch, selectedWallet])

    const { primaryName } = usePrimaryName({
        address: selectedWallet?.address,
        priority: 'onChain',
    })

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
                <WalletIconContainer src={getWalletIcon(selectedWallet || null, isPeanutWallet, false)} />

                {isConnected && !isInitializing ? (
                    <span>
                        {selectedWallet?.walletProviderType === WalletProviderType.PEANUT
                            ? 'Peanut Wallet'
                            : selectedWallet?.walletProviderType === WalletProviderType.REWARDS
                              ? 'Beer Wallet'
                              : (primaryName && truncateString(primaryName, 24)) ||
                                shortenAddressLong(selectedWallet?.address)}
                    </span>
                ) : (
                    <div className="flex items-center gap-2">
                        <img src={PEANUTMAN_LOGO.src} alt="logo" className="h-4 animate-spin" />
                        <div>Loading...</div>
                    </div>
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
                                key={wallet.id}
                                wallet={wallet}
                                isActive={wallet.id === selectedWallet?.id}
                                onClick={() => handleWalletSelection(wallet)}
                                hasConnectedExternalWallets={hasConnectedExternalWallets}
                            />
                        ))}
                        <AddNewWallet
                            onClick={connectWallet}
                            hasExternalWallets={hasExternalWallets}
                            hasConnectedExternalWallets={hasConnectedExternalWallets}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    )
}

// individual wallet card component
const WalletEntryCard: React.FC<WalletEntryCardProps> = ({
    wallet,
    isActive,
    onClick,
    hasConnectedExternalWallets,
}) => {
    const { username } = useAuth()
    const { rewardWalletBalance } = useWalletStore()
    const { isWalletConnected } = useWallet()
    const [showConfirmationModal, setShowConfirmationModal] = useState(false)
    const { connectWallet } = useWalletConnection()

    const isExternalWallet = useMemo(() => wallet.walletProviderType !== WalletProviderType.PEANUT, [wallet])
    const isPeanutWallet = useMemo(() => wallet.walletProviderType === WalletProviderType.PEANUT, [wallet])
    const isRewardsWallet = useMemo(() => wallet.walletProviderType === WalletProviderType.REWARDS, [wallet])
    const isConnected = isWalletConnected(wallet as IDBWallet)

    // get wallet icon to display
    const walletImage = useMemo(
        () => getWalletIcon(wallet, isPeanutWallet, isRewardsWallet),
        [wallet, isPeanutWallet, isRewardsWallet]
    )

    // get background color
    const backgroundColor = useMemo(() => {
        if (isPeanutWallet || isRewardsWallet || (isExternalWallet && isConnected)) {
            return isActive ? 'bg-primary-1 hover:bg-primary-1/90' : 'bg-purple-4 bg-opacity-25 hover:bg-opacity-20'
        }
        if (isExternalWallet && !isConnected) return 'bg-n-4'
    }, [isExternalWallet, isConnected, isActive, isPeanutWallet, isRewardsWallet])

    const { primaryName } = usePrimaryName({
        address: wallet.address,
        priority: 'onChain',
    })

    const handleCardClick = () => {
        // for external wallets that are not connected
        if (isExternalWallet && !isConnected) {
            // if there's already a connected external wallet, show confirmation modal
            if (hasConnectedExternalWallets) {
                setShowConfirmationModal(true)
            } else {
                // show reown modal directly
                connectWallet()
            }
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
                    : isRewardsWallet
                      ? 'Ready to Claim beers!'
                      : isExternalWallet && isConnected
                        ? 'Connected & Ready to sign'
                        : 'Not connected'}
            </p>
        </div>
    )

    const rewardBalanceText = useMemo(() => {
        let balance = Math.floor(Number(rewardWalletBalance))
        if (Number.isNaN(balance)) balance = 0
        if (balance === 0) return '0 Beers'
        return `${balance} Beer${balance > 1 ? 's' : ''}`
    }, [rewardWalletBalance])

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
                            <div className="notranslate flex items-center gap-2" translate="no">
                                {!isRewardsWallet ? (
                                    isPeanutWallet && username ? (
                                        <p className="text-base font-bold">Peanut Wallet</p>
                                    ) : (
                                        <p className="text-base font-bold">
                                            {(primaryName && truncateString(primaryName, 18)) ||
                                                shortenAddressLong(wallet.address)}
                                        </p>
                                    )
                                ) : (
                                    <p className="text-base font-bold">Beer Account</p>
                                )}
                                {!isRewardsWallet && (
                                    <CopyToClipboard
                                        className="h-4 w-4"
                                        fill={'black'}
                                        textToCopy={
                                            isPeanutWallet && username
                                                ? `https://peanut.me/${username}`
                                                : primaryName || wallet.address
                                        }
                                    />
                                )}
                            </div>
                            <WalletStatus />
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            {!isRewardsWallet ? (
                                <p className="text-base font-bold">${printableUsdc(wallet.balance)}</p>
                            ) : (
                                <p className="text-base font-bold">{rewardBalanceText}</p>
                            )}
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
const AddNewWallet = ({ onClick, hasExternalWallets, hasConnectedExternalWallets }: AddNewWalletProps) => {
    const [showConfirmationModal, setShowConfirmationModal] = useState(false)

    const handleClick = () => {
        if (hasExternalWallets && hasConnectedExternalWallets) {
            setShowConfirmationModal(true)
        } else {
            onClick()
        }
    }

    return (
        <>
            <Card onClick={handleClick}>
                <Card.Content className="flex min-h-16 w-full cursor-pointer items-center justify-center gap-3 bg-purple-5 px-4 py-3 hover:bg-opacity-90">
                    <div className="flex size-7 items-center justify-center rounded-full border border-n-1">
                        <Icon name="plus" fill="black" className="h-7 w-7" />
                    </div>
                    <span className="font-bold">Add wallet</span>
                </Card.Content>
            </Card>

            <ConfirmationModal
                wallet={null}
                showModal={showConfirmationModal}
                setShowModal={setShowConfirmationModal}
                onAccept={onClick}
                isAddWallet
            />
        </>
    )
}

const ConfirmationModal = ({ wallet, showModal, setShowModal, onAccept, isAddWallet }: ConfirmationModalProps) => {
    const { connectWallet, connectionStatus } = useWalletConnection()

    const handleAccept = async () => {
        await connectWallet()
        onAccept()
        setShowModal(false)
    }

    const modalContent = isAddWallet
        ? {
              title: 'Add a new wallet?',
              description: 'This will disconnect your currently connected external wallet.',
          }
        : {
              title: `Connect to ${shortenAddressLong(wallet?.address)}?`,
              description: 'This will disconnect any other external wallet currently connected.',
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
                    <ModalHeader title={modalContent.title} description={modalContent.description} wallet={wallet} />
                    <InfoBox>
                        <span className="font-bold">Important:</span> Make sure the account you want to connect is
                        selected in your external wallet.
                    </InfoBox>
                </div>
                <ModalActions onAccept={handleAccept} isConnecting={connectionStatus === 'connecting'} />
            </div>
        </Modal>
    )
}

export default WalletHeader

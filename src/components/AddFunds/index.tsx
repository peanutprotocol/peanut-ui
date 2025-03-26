import { COINBASE_LOGO, METAMASK_LOGO, RAINBOW_LOGO, TRUST_WALLET_LOGO } from '@/assets'
import CopyField from '@/components/Global/CopyField'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useUserStore } from '@/redux/hooks'
import { printableAddress } from '@/utils'
import Image from 'next/image'
import { ReactNode, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button, NavIcons } from '../0_Bruddle'
import Icon from '../Global/Icon'
import Modal from '../Global/Modal'
import QRCodeWrapper from '../Global/QRCodeWrapper'

const AddFunds = () => {
    const [addFundMethod, setAddFundMethod] = useState<'exchange' | 'request_link' | null>(null)
    const [showModal, setShowModal] = useState(false)

    const getModalContent = () => {
        switch (addFundMethod) {
            case 'exchange':
                return <UsingExchange />
            case 'request_link':
                return <UsingRequestLink />
            default:
                return <SelectFundingMethod setAddFundMethod={setAddFundMethod} />
        }
    }

    return (
        <div>
            {/* modal trigger */}
            <div onClick={() => setShowModal(true)} className="flex flex-col items-center gap-2.5">
                <Button
                    variant={'purple'}
                    className={twMerge('h-10 w-10 cursor-pointer rounded-full p-0')}
                    shadowSize="4"
                >
                    <Icon name="plus" className="h-5 w-5" />
                </Button>
                <div className="font-semibold">Add</div>
            </div>

            {/* modal content */}
            <Modal
                hideOverlay={addFundMethod === 'request_link'}
                visible={showModal}
                onClose={() => {
                    setAddFundMethod(null)
                    setShowModal(false)
                }}
                className="w-full items-center"
                classWrap="bg-background rounded-none border-0 p-6 w-full max-h-[90vh] md:max-h-full overflow-y-auto"
            >
                {getModalContent()}
            </Modal>
        </div>
    )
}

const UsingExchange = () => {
    const [understood, setUnderstood] = useState(false)
    const { peanutWalletDetails } = useWallet()

    const peanutWalletAddress = useMemo(() => {
        return peanutWalletDetails?.address ?? ''
    }, [peanutWalletDetails])

    return (
        <div className="relative w-full space-y-4">
            {/* Header */}
            <div className="space-y-1">
                <h2 className="text-2xl font-black">Add funds</h2>
                <p className="text-sm">Only send USDC on Arbitrum is supported.</p>
            </div>

            {/* QR Code */}
            <div
                className={`mx-auto w-fit rounded-md border border-black bg-white p-4 transition-all duration-300 ${!understood ? 'blur-md' : ''}`}
            >
                <QRCodeWrapper url={peanutWalletAddress} />
            </div>

            {/* Copy Address Field */}
            <CopyField
                text={peanutWalletAddress}
                displayText={printableAddress(peanutWalletAddress)}
                shadowSize="4"
                disabled={!understood}
            />

            <div className="space-y-2">
                {/* Warning Text */}
                <p className="text-xs text-gray-1">
                    Only USDC on Arbitrum is supported. Sending any other token or using a different network will result
                    in a loss of funds.
                </p>

                {/* Checkbox */}
                <label className="flex cursor-pointer items-center gap-2">
                    <input
                        type="checkbox"
                        checked={understood}
                        onChange={(e) => setUnderstood(e.target.checked)}
                        className="h-4 w-4 accent-white"
                    />
                    <span className="text-sm font-medium">I understand.</span>
                </label>
            </div>
        </div>
    )
}

const UsingRequestLink = () => {
    const [linkCopied, setLinkCopied] = useState(false)

    const { user } = useUserStore()

    const depositLink = useMemo(() => {
        return `https://peanut.me/${user?.user?.username}?action=deposit`
    }, [user])

    const wallets = useMemo(
        () => [
            {
                name: 'MetaMask',
                logo: METAMASK_LOGO,
            },
            {
                name: 'Trust Wallet',
                logo: TRUST_WALLET_LOGO,
            },
            {
                name: 'Coinbase',
                logo: COINBASE_LOGO,
            },
            {
                name: 'Rainbow',
                logo: RAINBOW_LOGO,
            },
        ],
        []
    )

    return (
        <div className="w-full space-y-6">
            {/* Header */}
            <div className="space-y-2 text-start">
                <h2 className="text-2xl font-black">Use a Self-Custodial Wallet</h2>
                <p className="text-sm text-gray-600">Follow these steps to add funds using your wallet</p>
            </div>

            {/* Steps Container */}
            <div className="space-y-6">
                {/* Step 1: Copy Link */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-black bg-black text-sm text-white">
                            1
                        </div>
                        <h3 className="font-semibold">Copy deposit link</h3>
                    </div>
                    <Button
                        variant="purple"
                        onClick={() => {
                            navigator.clipboard.writeText(depositLink)
                            setLinkCopied(true)
                            setTimeout(() => setLinkCopied(false), 2000)
                        }}
                        shadowSize="4"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icon name={linkCopied ? 'check' : 'content-copy'} className="h-5 w-5" />
                                <span>{linkCopied ? 'Copied!' : 'Copy'}</span>
                            </div>
                        </div>
                    </Button>
                </div>

                {/* Step 2: Open Wallet */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-black bg-black text-sm text-white">
                            2
                        </div>
                        <h3 className="font-semibold">Open your preferred wallet</h3>
                    </div>
                    {/* Wallet Icons Grid */}
                    <div className="grid grid-cols-4 gap-4">
                        {wallets.map((wallet) => (
                            <div key={wallet.name} className="flex flex-col items-center gap-2">
                                <div className="bg-white-100 flex h-12 w-12 items-center justify-center rounded-full border bg-white">
                                    <Image src={wallet.logo} className="h-8 w-8" alt="Wallet Logo" />
                                </div>
                                <span className="text-center text-xs">{wallet.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Step 3: Paste in Browser */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-black bg-black text-sm text-white">
                            3
                        </div>
                        <h3 className="font-semibold">Paste link in wallet's browser</h3>
                    </div>
                    {/* Visual Guide */}
                    <div className="shadow-primary-4 flex items-center justify-center border border-black bg-primary-1/10 p-4">
                        <p className="text-sm">
                            Open your wallet's built-in browser and paste the copied link to proceed with the
                            transaction
                        </p>
                    </div>
                </div>
            </div>

            {/* Info Box */}
            <div className="space-y-3">
                <InfoBox
                    title="Note"
                    description={
                        "Make sure to use the browser within your wallet app. Using a regular browser won't work."
                    }
                />
                <InfoBox
                    title="Important"
                    description={
                        'Only USDC on Arbitrum is supported. Sending any other token or using a different network will result in a loss of funds.'
                    }
                />
            </div>
        </div>
    )
}

const SelectFundingMethod = ({
    setAddFundMethod,
}: {
    setAddFundMethod: (method: 'exchange' | 'request_link') => void
}) => {
    return (
        <div className="w-full space-y-6">
            {/* Header */}
            <div className="space-y-2 text-start">
                <h2 className="text-2xl font-black">Add funds</h2>
                <p className="text-sm text-gray-600">Choose how you want to add funds to your wallet</p>
            </div>

            {/* Method Selection Cards */}
            <div className="space-y-6">
                {/* Self Custodial Wallet Option */}
                <button
                    onClick={() => setAddFundMethod('request_link')}
                    className="shadow-primary-4 w-full border border-black bg-primary-1 p-4 text-left transition-all hover:bg-primary-1/80"
                >
                    <div className="flex items-start gap-4">
                        <div className="flex items-center justify-center rounded-full bg-white p-3">
                            <NavIcons name="wallet" size={20} />
                        </div>
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold">Use a Self-Custodial Wallet</h3>
                                <Icon name="arrow-next" className="h-5 w-5 text-gray-400" />
                            </div>
                            <p className="text-sm text-gray-600">
                                Send funds directly from your web3 wallet like MetaMask, Trust Wallet, or any other
                                self-custodial wallet.
                            </p>
                        </div>
                    </div>
                </button>

                {/* Exchange Option */}
                <button
                    onClick={() => setAddFundMethod('exchange')}
                    className="shadow-primary-4 w-full border border-black bg-secondary-1 p-4 text-left transition-all hover:bg-secondary-1/80"
                >
                    <div className="flex items-start gap-4">
                        <div className="flex items-center justify-center rounded-full bg-white p-3">
                            <Icon name="bank" className="h-5 w-5" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold">Use an Exchange</h3>
                                <Icon name="arrow-next" className="h-5 w-5 text-gray-400" />
                            </div>
                            <p className="text-sm text-gray-600">
                                Send funds from your exchange account like Coinbase, Binance, or any other centralized
                                exchange.
                            </p>
                        </div>
                    </div>
                </button>
            </div>

            {/* Info Box */}
            <InfoBox
                title="Important"
                description="Only USDC on Arbitrum network is supported. Sending any other token or using a different network will result in loss of funds."
            />
        </div>
    )
}

const InfoBox = ({ title, description }: { title?: string; description: string | ReactNode }) => {
    return (
        <div className="border border-gray-1 bg-white p-4">
            <div className="flex items-start gap-3">
                <div className="flex items-start justify-start gap-2 px-1">
                    <div className="flex-shrink-0">
                        <Icon name="info" className="h-5 w-5 text-gray-1" />
                    </div>
                </div>
                <div className="flex items-start justify-start gap-2">
                    <div className="text-xs font-normal text-gray-1">
                        {title && <span className="font-bold">{title}: </span>}
                        {description}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AddFunds

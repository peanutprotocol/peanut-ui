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

type DepositMethod = 'exchange' | 'request_link' | null

type Wallet = { name: string; logo: string }

const AddFunds = () => {
    const [addFundMethod, setAddFundMethod] = useState<DepositMethod>(null)
    const [showModal, setShowModal] = useState(false)

    const handleClose = () => {
        // first close modal
        setShowModal(false)

        // reset deposit method with a delay
        const timer = setTimeout(() => {
            setAddFundMethod(null)
        }, 300)

        return () => clearTimeout(timer)
    }

    return (
        <div>
            <div onClick={() => setShowModal(true)} className="flex flex-col items-center gap-2.5">
                <Button variant="purple" className={twMerge('h-10 w-10 rounded-full p-0')} shadowSize="4">
                    <Icon name="plus" className="h-5 w-5" />
                </Button>
                <div className="font-semibold">Add</div>
            </div>

            <Modal
                hideOverlay={addFundMethod === 'request_link'}
                visible={showModal}
                onClose={handleClose}
                className="w-full items-center"
                classWrap="bg-background rounded-none p-6 max-h-[90vh] md:max-h-full overflow-y-auto"
            >
                {addFundMethod === 'exchange' ? (
                    <UsingExchange />
                ) : addFundMethod === 'request_link' ? (
                    <UsingRequestLink />
                ) : (
                    <SelectFundingMethod setAddFundMethod={setAddFundMethod} />
                )}
            </Modal>
        </div>
    )
}

const UsingExchange = () => {
    const [understood, setUnderstood] = useState(false)
    const [showWarning, setShowWarning] = useState(false)
    const { peanutWalletDetails } = useWallet()

    const peanutWalletAddress = useMemo(() => {
        return peanutWalletDetails?.address ?? ''
    }, [peanutWalletDetails])

    const handleDisabledCopy = () => {
        if (!understood) {
            setShowWarning(true)
            setTimeout(() => setShowWarning(false), 3000)
        }
    }

    return (
        <div className="w-full space-y-4">
            <Header title="Add funds" subtitle="Only send USDC on Arbitrum is supported." />

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
                onDisabledClick={handleDisabledCopy}
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
                        onChange={(e) => {
                            setUnderstood(e.target.checked)
                            setShowWarning(false)
                        }}
                        className="h-4 w-4 accent-white"
                    />
                    <span className={twMerge(`text-sm font-medium ${showWarning ? 'text-red' : ''} transition-colors`)}>
                        I understand.
                    </span>
                </label>
            </div>
        </div>
    )
}

const UsingRequestLink = () => {
    const [linkCopied, setLinkCopied] = useState(false)
    const { user } = useUserStore()
    const depositLink = `https://peanut.me/${user?.user?.username}?action=deposit`

    const wallets: Wallet[] = useMemo(
        () => [
            { name: 'MetaMask', logo: METAMASK_LOGO },
            { name: 'Trust Wallet', logo: TRUST_WALLET_LOGO },
            { name: 'Coinbase', logo: COINBASE_LOGO },
            { name: 'Rainbow', logo: RAINBOW_LOGO },
        ],
        []
    )

    return (
        <div className="w-full space-y-6">
            <Header title="Use a Self-Custodial Wallet" subtitle="Follow these steps to add funds using your wallet" />
            <Step number={1} title="Copy deposit link">
                <CopyField variant="purple" text={depositLink} shadowSize="4" />
            </Step>
            <Step number={2} title="Open your preferred wallet">
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
            </Step>
            <Step number={3} title="Paste link in wallet's browser">
                <div className="shadow-primary-4 flex items-center justify-center border border-black bg-primary-1/10 p-4">
                    <p className="text-sm">
                        Open your wallet's built-in browser and paste the copied link to proceed with the transaction
                    </p>
                </div>
            </Step>{' '}
            {/* Info Box */}
            <div className="space-y-3">
                <InfoBox
                    title="Note"
                    description={'Make sure to use the browser within your wallet app for better experience.'}
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
            <Header title="Add funds" subtitle="Choose how you want to add funds to your wallet" />

            {/* Method Selection Cards */}
            <div className="space-y-6">
                {/* Self Custodial Wallet Option */}
                <button
                    onClick={() => setAddFundMethod('request_link')}
                    className="shadow-primary-4 w-full border border-black bg-primary-1 p-4 text-left transition-all hover:bg-primary-1/80"
                >
                    <div className="flex items-start gap-4">
                        <div className="flex items-center justify-center rounded-full border border-black bg-white p-3">
                            <NavIcons name="wallet" size={20} />
                        </div>
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold">Use a Self-Custodial Wallet</h3>
                                <Icon name="arrow-next" className="h-5 w-5 text-gray-400" />
                            </div>
                            <p className="text-sm">
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
                        <div className="flex items-center justify-center rounded-full border border-black bg-white p-3">
                            <Icon name="bank" className="h-5 w-5" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold">Use an Exchange</h3>
                                <Icon name="arrow-next" className="h-5 w-5 text-gray-400" />
                            </div>
                            <p className="text-sm">
                                Send funds from your exchange account like Coinbase, Binance, or any other centralized
                                exchange.
                            </p>
                        </div>
                    </div>
                </button>
            </div>
        </div>
    )
}

const Header = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div className="text-start">
        <h2 className="text-2xl font-black">{title}</h2>
        {subtitle && <p className="text-sm text-gray-1">{subtitle}</p>}
    </div>
)

const Step = ({ number, title, children }: { number: number; title: string; children: ReactNode }) => (
    <div className="space-y-3">
        <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full border bg-black text-white">
                {number}
            </div>
            <h3 className="font-semibold">{title}</h3>
        </div>
        {children}
    </div>
)

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

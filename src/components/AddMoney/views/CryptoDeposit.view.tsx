'use client'

import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import PeanutLoading from '@/components/Global/PeanutLoading'
import ChainChip from '../components/ChainChip'
import HowToDepositModal from '../components/HowToDepositModal'
import SupportedNetworksModal from '../components/SupportedNetworksModal'
import { useCryptoDepositPolling } from '../hooks/useCryptoDepositPolling'
import {
    CHAIN_LOGOS,
    SUPPORTED_EVM_CHAINS,
    NETWORK_LABELS,
    NETWORK_LOGOS,
    getSupportedTokens,
} from '@/constants/rhino.consts'
import type {
    CreateDepositAddressResponse,
    DepositAddressStatusResponse,
    RhinoChainType,
} from '@/services/services.types'
import InfoCard from '@/components/Global/InfoCard'
import { Tooltip } from '@/components/Tooltip'
import { useState } from 'react'
import Image from 'next/image'

interface CryptoDepositViewProps {
    network: RhinoChainType
    depositAddressData: CreateDepositAddressResponse | undefined
    isLoading: boolean
    onSuccess: (amount: number, statusData?: DepositAddressStatusResponse) => void
    onBack: () => void
}

const TOOLTIP_TEXT: Record<RhinoChainType, string> = {
    EVM: `${SUPPORTED_EVM_CHAINS.length} EVM networks supported. For exact amounts, deposit USDC on Arbitrum. Other chains/tokens are bridged (±0.1%).`,
    SOL: 'Your Solana deposit address. Deposits are bridged to Arbitrum (±0.1% variance).',
    TRON: 'Your Tron deposit address. Deposits are bridged to Arbitrum (±0.1% variance).',
}

const CryptoDepositView = ({ network, depositAddressData, isLoading, onSuccess, onBack }: CryptoDepositViewProps) => {
    const [showHowToDeposit, setShowHowToDeposit] = useState(false)
    const [showSupportedNetworks, setShowSupportedNetworks] = useState(false)
    const { status, resetStatus, isResetting } = useCryptoDepositPolling(depositAddressData?.depositAddress, onSuccess)

    const networkLabel = NETWORK_LABELS[network]
    const isEvm = network === 'EVM'

    const supportedTokens = getSupportedTokens(network)

    const amountLimitsLabel = isEvm ? 'EVM networks' : networkLabel

    // failed state
    if (status === 'failed') {
        return (
            <div className="flex min-h-[inherit] w-full flex-col justify-start gap-8 pb-5 md:pb-0">
                <NavHeader title="Deposit Crypto" onPrev={onBack} />
                <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4">
                    <Card>
                        <div className="flex w-full flex-col items-center justify-center gap-2">
                            <div className="flex size-9 items-center justify-center rounded-full bg-secondary-1">
                                <Icon name="alert" size={20} />
                            </div>
                            <h1 className="text-base font-bold">Oops! Market moved</h1>
                            <p className="text-center text-sm text-grey-1">
                                The exchange rate changed too much to complete your deposit.
                            </p>
                            <p className="text-center text-sm font-bold text-grey-1">
                                Your money is on its way back to your wallet.
                            </p>
                        </div>
                    </Card>
                    <Button onClick={resetStatus} shadowSize="4" loading={isResetting} disabled={isResetting}>
                        Try Again
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-[inherit] w-full flex-col gap-8 pb-5 md:pb-0">
            <NavHeader title="Deposit Crypto" onPrev={onBack} />

            <div className="my-auto flex w-full flex-col gap-4">
                {/* subtitle */}
                <p className="text-center text-sm text-grey-1">
                    Send tokens to this <span className="font-bold text-n-1">{networkLabel}</span> address
                </p>

                {/* loading state */}
                {(isLoading || status === 'loading') && (
                    <div className="flex h-[60vh] items-center justify-center">
                        <PeanutLoading message={status === 'loading' ? 'Almost there! Processing...' : undefined} />
                    </div>
                )}

                {depositAddressData && !isLoading && status !== 'loading' && (
                    <>
                        {/* qr code */}
                        <div className="flex items-center justify-center">
                            <QRCodeWrapper
                                url={depositAddressData.depositAddress}
                                centerImage={NETWORK_LOGOS[network]}
                            />
                        </div>

                        {/* deposit address + networks + tokens card — white bg */}
                        <div className="flex flex-col overflow-hidden rounded-sm border border-black bg-white">
                            {/* address section */}
                            <div className="flex flex-col gap-2 p-4">
                                <div className="flex items-center gap-1">
                                    <Tooltip content={TOOLTIP_TEXT[network]} position="bottom">
                                        <span className="flex items-center gap-1">
                                            <span className="text-sm font-bold">
                                                {isEvm ? 'Universal Deposit Address' : 'Deposit Address'}
                                            </span>
                                            <Icon name="info" size={18} className="text-grey-1" />
                                        </span>
                                    </Tooltip>
                                </div>
                                <div className="flex items-start justify-between gap-2">
                                    <p className="break-all text-sm">
                                        <span className="font-semibold">
                                            {depositAddressData.depositAddress.slice(0, 6)}
                                        </span>
                                        {depositAddressData.depositAddress.slice(6, -6)}
                                        <span className="font-semibold">
                                            {depositAddressData.depositAddress.slice(-6)}
                                        </span>
                                    </p>
                                    <CopyToClipboard
                                        textToCopy={depositAddressData.depositAddress}
                                        iconSize="4"
                                        className="flex-shrink-0"
                                    />
                                </div>
                            </div>

                            {/* supported networks section */}
                            <div
                                onClick={() => {
                                    if (isEvm) {
                                        setShowSupportedNetworks(true)
                                    }
                                }}
                                className={`border-t border-black p-4 ${isEvm ? 'cursor-pointer' : ''}`}
                            >
                                <p className="mb-2 text-sm font-bold">Supported Networks:</p>
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-wrap gap-2">
                                        {isEvm ? (
                                            <>
                                                {SUPPORTED_EVM_CHAINS.map((chain) => (
                                                    <Image
                                                        key={chain}
                                                        src={CHAIN_LOGOS[chain]}
                                                        alt={chain}
                                                        width={22}
                                                        height={22}
                                                        className="h-5 w-5 rounded-full border border-black object-cover"
                                                    />
                                                ))}
                                            </>
                                        ) : (
                                            <ChainChip
                                                chainName={networkLabel.toUpperCase()}
                                                chainSymbol={NETWORK_LOGOS[network]}
                                            />
                                        )}
                                    </div>
                                    {isEvm && (
                                        <Button
                                            shadowSize="4"
                                            size="small"
                                            className="ml-auto h-6 w-6 flex-shrink-0 rounded-full p-0 shadow-[0.12rem_0.12rem_0_#000000]"
                                        >
                                            <div className="flex size-7 items-center justify-center">
                                                <Icon name="chevron-up" className="h-9 rotate-90" />
                                            </div>
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* supported tokens section */}
                            <div className="border-t border-black p-4">
                                <p className="mb-2 text-sm font-bold">Supported Tokens:</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {supportedTokens.map((token) => (
                                        <ChainChip
                                            key={token.name}
                                            chainName={token.name}
                                            chainSymbol={token.logoUrl}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* warning card */}
                        <InfoCard
                            variant="warning"
                            icon="alert"
                            title="Send to supported networks only"
                            description="Wrong token or network may cause permanent loss."
                        />

                        {/* min/max limits */}
                        <div className="w-full space-y-1">
                            <div className="flex w-full items-center justify-between">
                                <p className="text-sm text-grey-1">Min deposit for {amountLimitsLabel}:</p>
                                <p className="text-sm font-bold">
                                    {depositAddressData.minDepositLimitUsd.toLocaleString()} USD
                                </p>
                            </div>
                            <div className="flex w-full items-center justify-between">
                                <p className="text-sm text-grey-1">Max deposit for {amountLimitsLabel}:</p>
                                <p className="text-sm font-bold">
                                    {depositAddressData.maxDepositLimitUsd.toLocaleString()} USD
                                </p>
                            </div>
                        </div>

                        {/* how to deposit button */}
                        <Button
                            variant="stroke"
                            className="w-full bg-white"
                            shadowSize="4"
                            onClick={() => setShowHowToDeposit(true)}
                        >
                            <Icon name="info" size={16} className="mr-1.5" />
                            How to Deposit
                        </Button>
                    </>
                )}
            </div>

            {/* modals */}
            <HowToDepositModal visible={showHowToDeposit} onClose={() => setShowHowToDeposit(false)} />
            <SupportedNetworksModal visible={showSupportedNetworks} onClose={() => setShowSupportedNetworks(false)} />
        </div>
    )
}

export default CryptoDepositView

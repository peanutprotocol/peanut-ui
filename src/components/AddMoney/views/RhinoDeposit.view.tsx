'use client'
import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import CopyToClipboard, { type CopyToClipboardRef } from '@/components/Global/CopyToClipboard'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import ChainChip from '../components/ChainChip'
import InfoCard from '@/components/Global/InfoCard'
import { Root, List, Trigger } from '@radix-ui/react-tabs'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { useRef } from 'react'
import { useCryptoDepositPolling } from '../hooks/useCryptoDepositPolling'
import type { CreateDepositAddressResponse, RhinoChainType } from '@/services/services.types'
import { useAutoTruncatedAddress } from '@/hooks/useAutoTruncatedAddress'
import { CHAIN_LOGOS, SUPPORTED_EVM_CHAINS, NETWORK_LABELS, getSupportedTokens } from '@/constants/rhino.consts'
import UserCard from '@/components/User/UserCard'
import { isCryptoAddress, printableAddress } from '@/utils/general.utils'

interface RhinoDepositViewProps {
    onBack?: () => void
    chainType: RhinoChainType
    setChainType: (chainType: RhinoChainType) => void
    depositAddressData: CreateDepositAddressResponse | undefined
    isDepositAddressDataLoading: boolean
    headerTitle: string
    onSuccess: (amount: number) => void
    showUserCard?: boolean
    amount?: number
    identifier?: string
}

const RhinoDepositView = ({
    onBack,
    chainType,
    setChainType,
    depositAddressData,
    isDepositAddressDataLoading,
    headerTitle,
    onSuccess,
    showUserCard = false,
    amount,
    identifier,
}: RhinoDepositViewProps) => {
    const copyRef = useRef<CopyToClipboardRef>(null)
    const {
        status: depositAddressStatus,
        resetStatus,
        isResetting,
    } = useCryptoDepositPolling(depositAddressData?.depositAddress, onSuccess)

    const { containerRef, truncatedAddress } = useAutoTruncatedAddress(depositAddressData?.depositAddress ?? '')

    const amountLimitsTitle = chainType === 'EVM' ? 'EVM networks' : NETWORK_LABELS[chainType]

    if (depositAddressStatus === 'failed') {
        return (
            <div className="flex min-h-[inherit] w-full flex-col justify-start space-y-8 pb-5 md:pb-0">
                <NavHeader title={headerTitle} onPrev={onBack} />

                <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4">
                    <Card>
                        <div className=" flex w-full flex-col items-center justify-center gap-2">
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
        <div className="flex w-full flex-col justify-start space-y-8 pb-5 md:pb-0">
            <NavHeader title={headerTitle} onPrev={onBack} />

            <div className="my-auto flex w-full flex-grow flex-col items-center justify-center gap-4 md:my-0">
                {showUserCard && (
                    <UserCard
                        recipientType={isCryptoAddress(identifier ?? '') ? 'ADDRESS' : 'USERNAME'}
                        type="request_fulfilment"
                        username={
                            isCryptoAddress(identifier ?? '') ? printableAddress(identifier ?? '') : (identifier ?? '')
                        }
                        amount={amount}
                    />
                )}
                <Root
                    value={chainType}
                    onValueChange={(e) => setChainType(e as RhinoChainType)}
                    defaultValue="EVM"
                    className="w-full"
                >
                    <List className="flex w-full items-center rounded-xl bg-white p-0" aria-label="Select network type">
                        <Trigger
                            value="EVM"
                            className="flex-1 rounded-xl border border-transparent py-1.5 text-sm font-medium text-grey-1 transition-all data-[state=active]:border-primary-1 data-[state=active]:bg-primary-1/10 data-[state=active]:text-primary-1"
                        >
                            EVM
                        </Trigger>
                        <Trigger
                            value="SOL"
                            className="flex-1 rounded-xl border border-transparent py-1.5 text-sm font-medium text-grey-1 transition-all data-[state=active]:border-primary-1 data-[state=active]:bg-primary-1/10 data-[state=active]:text-primary-1"
                        >
                            Solana
                        </Trigger>
                        <Trigger
                            value="TRON"
                            className="flex-1 rounded-xl border border-transparent py-1.5 text-sm font-medium text-grey-1 transition-all data-[state=active]:border-primary-1 data-[state=active]:bg-primary-1/10 data-[state=active]:text-primary-1"
                        >
                            Tron
                        </Trigger>
                    </List>
                </Root>

                {(isDepositAddressDataLoading || depositAddressStatus === 'loading') && (
                    <div className="flex h-[60vh] items-center justify-center">
                        <PeanutLoading
                            message={depositAddressStatus === 'loading' ? 'Almost there! Processing...' : undefined}
                        />
                    </div>
                )}

                {depositAddressData && !isDepositAddressDataLoading && depositAddressStatus !== 'loading' && (
                    <>
                        <div className="flex items-center justify-center">
                            <QRCodeWrapper url={depositAddressData?.depositAddress} />
                        </div>

                        <Button
                            variant="primary-soft"
                            className="flex h-8 w-2/3 cursor-pointer items-center justify-center gap-1.5 rounded-full px-2.5 md:h-9 md:px-3.5"
                            shadowSize="3"
                            size="small"
                            onClick={() => copyRef.current?.copy()}
                        >
                            <p className="w-full text-sm" ref={containerRef}>
                                {truncatedAddress}
                            </p>
                            <CopyToClipboard ref={copyRef} type="icon" textToCopy={depositAddressData.depositAddress} />
                        </Button>

                        <InfoCard
                            iconClassName="text-yellow-11"
                            variant="warning"
                            icon="alert"
                            containerClassName="items-center"
                            customContent={
                                <div className="flex items-center gap-2">
                                    <p className="text-sm">Supported tokens:</p>
                                    {getSupportedTokens(chainType).map((token) => (
                                        <ChainChip
                                            key={token.name}
                                            chainName={token.name}
                                            chainSymbol={token.logoUrl}
                                        />
                                    ))}
                                </div>
                            }
                        />

                        <div className="w-full space-y-1">
                            <div className="flex w-full items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Icon name="info" size={18} className="text-grey-1" />
                                    <p className="text-sm text-grey-1">Min deposit for {amountLimitsTitle}</p>
                                </div>

                                <p className="text-sm font-medium text-grey-1">
                                    {depositAddressData.minDepositLimitUsd} USD
                                </p>
                            </div>

                            <div className="flex w-full items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Icon name="info" size={18} className="text-grey-1" />
                                    <p className="text-sm text-grey-1">Max deposit for {amountLimitsTitle}</p>
                                </div>

                                <p className="text-sm font-medium text-grey-1">
                                    {depositAddressData.maxDepositLimitUsd} USD
                                </p>
                            </div>
                        </div>

                        {chainType === 'EVM' && (
                            <Card className="space-y-2 p-4">
                                <h3 className="text-sm font-bold text-black">Supported EVM networks</h3>
                                <div className="flex flex-wrap gap-2">
                                    {SUPPORTED_EVM_CHAINS.map((chain) => (
                                        <ChainChip key={chain} chainName={chain} chainSymbol={CHAIN_LOGOS[chain]} />
                                    ))}
                                </div>
                            </Card>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

export default RhinoDepositView

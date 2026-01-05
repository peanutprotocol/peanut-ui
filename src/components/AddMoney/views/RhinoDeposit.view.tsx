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
import { useQuery } from '@tanstack/react-query'
import { rhinoApi } from '@/services/rhino'
import { useState, useEffect, useMemo, useRef } from 'react'
import type { CreateDepositAddressResponse, RhinoChainType } from '@/services/services.types'
import { useAutoTruncatedAddress } from '@/hooks/useAutoTruncatedAddress'
import { CHAIN_LOGOS, RHINO_SUPPORTED_TOKENS, SUPPORTED_EVM_CHAINS } from '@/constants/rhino.consts'
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
    const [isDelayComplete, setIsDelayComplete] = useState(false)
    const [isUpdatingDepositAddresStatus, setisUpdatingDepositAddresStatus] = useState(false)
    const copyRef = useRef<CopyToClipboardRef>(null)

    const POLLING_DELAY = 15_000

    useEffect(() => {
        const timer = setTimeout(() => setIsDelayComplete(true), POLLING_DELAY)
        return () => clearTimeout(timer)
    }, [])

    const { data: depositAddressStatusData } = useQuery({
        queryKey: ['rhino-deposit-address-status', depositAddressData?.depositAddress],
        queryFn: () => {
            if (!depositAddressData?.depositAddress) {
                throw new Error('Deposit address is required')
            }
            return rhinoApi.getDepositAddressStatus(depositAddressData.depositAddress as string)
        },
        enabled: !!depositAddressData?.depositAddress && isDelayComplete, // Add some delay to start polling after the deposit address is created
        refetchInterval: (query) => (query.state.data?.status === 'completed' ? false : 5000),
    })

    const { containerRef, truncatedAddress } = useAutoTruncatedAddress(depositAddressData?.depositAddress ?? '')

    const depositAddressStatus = useMemo(() => {
        if (depositAddressStatusData?.status === 'accepted') {
            return 'loading'
        } else if (depositAddressStatusData?.status === 'pending') {
            return 'loading'
        } else if (depositAddressStatusData?.status === 'failed') {
            return 'failed'
        } else if (depositAddressStatusData?.status === 'completed') {
            return 'completed'
        } else {
            return 'not_started'
        }
    }, [depositAddressStatusData])

    // Optimistic update of the deposit address status
    const updateDepositAddressStatus = async () => {
        if (isUpdatingDepositAddresStatus) return // Prevent concurrent calls

        if (!depositAddressData?.depositAddress) {
            return
        }

        setisUpdatingDepositAddresStatus(true)
        await rhinoApi.resetDepositAddressStatus(depositAddressData.depositAddress)
        setisUpdatingDepositAddresStatus(false)
    }

    const amountLimitsTitle = useMemo(() => {
        if (chainType === 'EVM') {
            return 'EVM networks'
        } else if (chainType === 'SOL') {
            return 'Solana'
        } else if (chainType === 'TRON') {
            return 'Tron'
        }
    }, [chainType])

    useEffect(() => {
        if (depositAddressStatus === 'completed' && depositAddressStatusData?.amount) {
            onSuccess(depositAddressStatusData?.amount)
        }
    }, [depositAddressStatusData, depositAddressStatus, onSuccess])

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
                    <Button
                        onClick={updateDepositAddressStatus}
                        shadowSize="4"
                        loading={isUpdatingDepositAddresStatus}
                        disabled={isUpdatingDepositAddresStatus}
                    >
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

                {depositAddressData && !isDepositAddressDataLoading && (
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
                                    {RHINO_SUPPORTED_TOKENS.filter((token) => {
                                        if (chainType === 'TRON') {
                                            return token.name !== 'USDT'
                                        }
                                        return true
                                    }).map((token) => (
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

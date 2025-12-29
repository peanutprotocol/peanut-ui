'use client'
import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import ChainChip from '../components/ChainChip'
import InfoCard from '@/components/Global/InfoCard'
import { Root, List, Trigger } from '@radix-ui/react-tabs'
import { useAuth } from '@/context/authContext'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { useQuery } from '@tanstack/react-query'
import { rhinoApi } from '@/services/rhino'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useState, useEffect, useMemo } from 'react'
import type { CreateDepositAddressResponse, RhinoChainType } from '@/services/services.types'
import { useAutoTruncatedAddress } from '@/hooks/useAutoTruncatedAddress'
import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import { CHAIN_LOGOS, RHINO_SUPPORTED_TOKENS, SUPPORTED_EVM_CHAINS } from '@/constants/rhino.consts'

interface RhinoDepositViewProps {
    onBack?: () => void
    chainType: RhinoChainType
    setChainType: (chainType: RhinoChainType) => void
    depositAddressData: CreateDepositAddressResponse | undefined
    isDepositAddressDataLoading: boolean
}

const RhinoDepositView = ({
    onBack,
    chainType,
    setChainType,
    depositAddressData,
    isDepositAddressDataLoading,
}: RhinoDepositViewProps) => {
    const { user } = useAuth()
    const { isConnected } = useWallet()
    const [isDelayComplete, setIsDelayComplete] = useState(false)
    const [isUpdatingDepositAddresStatus, setisUpdatingDepositAddresStatus] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => setIsDelayComplete(true), 15_000)
        return () => clearTimeout(timer)
    }, [])

    const { data: depositAddressStatusData } = useQuery({
        queryKey: ['rhino-deposit-address-status', depositAddressData?.depositAddress],
        queryFn: () => rhinoApi.getDepositAddressStatus(depositAddressData?.depositAddress as string),
        enabled: !!depositAddressData?.depositAddress && isDelayComplete, // Add some delay to start polling after the deposit address is created
        refetchInterval: 5000, // 5 seconds
    })

    const { containerRef, truncatedAddress } = useAutoTruncatedAddress(depositAddressData?.depositAddress ?? '')

    const depositAddressStatus = useMemo(() => {
        if (depositAddressStatusData?.status == 'accepted') {
            return 'loading'
        } else if (depositAddressStatusData?.status == 'pending') {
            return 'loading'
        } else if (depositAddressStatusData?.status == 'failed') {
            return 'failed'
        } else if (depositAddressStatusData?.status == 'completed') {
            return 'completed'
        } else {
            return 'not_started'
        }
    }, [depositAddressStatusData])

    const updateDepositAddressStatus = async () => {
        setisUpdatingDepositAddresStatus(true)
        await rhinoApi.resetDepositAddressStatus(depositAddressData?.depositAddress as string)
        setisUpdatingDepositAddresStatus(false)
    }

    if (!isConnected || !user || isDepositAddressDataLoading || depositAddressStatus === 'loading') {
        return (
            <PeanutLoading message={depositAddressStatus === 'loading' ? 'Almost there! Processing...' : undefined} />
        )
    }

    if (depositAddressStatus === 'completed' && depositAddressStatusData?.amount) {
        return <PaymentSuccessView type="DEPOSIT" amount={depositAddressStatusData.amount.toString()} />
    }

    if (depositAddressStatus === 'failed') {
        return (
            <div className="flex min-h-[inherit] w-full flex-col justify-start space-y-8 pb-5 md:pb-0">
                <NavHeader title={'Add Money'} onPrev={onBack} />

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
            <NavHeader title={'Add Money'} onPrev={onBack} />
            {depositAddressData && (
                <div className="my-auto flex w-full flex-grow flex-col items-center justify-center gap-4 md:my-0">
                    <Root
                        value={chainType}
                        onValueChange={(e) => setChainType(e as RhinoChainType)}
                        defaultValue="EVM"
                        className="w-full"
                    >
                        <List
                            className="flex w-full items-center rounded-xl bg-white p-0"
                            aria-label="Select network type"
                        >
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

                    <div className="flex items-center justify-center">
                        <QRCodeWrapper url={depositAddressData?.depositAddress} />
                    </div>

                    <Button
                        variant="primary-soft"
                        className="flex h-8 w-2/3 cursor-pointer items-center justify-center gap-1.5 rounded-full px-2.5 md:h-9 md:px-3.5"
                        shadowSize="3"
                        size="small"
                    >
                        <p className="w-full text-sm" ref={containerRef}>
                            {truncatedAddress}
                        </p>
                        <CopyToClipboard type="icon" textToCopy={depositAddressData.depositAddress} />
                    </Button>

                    <InfoCard
                        iconClassName="text-yellow-11"
                        variant="warning"
                        icon="alert"
                        containerClassName="items-center"
                        customContent={
                            <div className="flex items-center gap-2">
                                <p className="text-sm">Supported tokens:</p>
                                {RHINO_SUPPORTED_TOKENS.map((token) => (
                                    <ChainChip key={token.name} chainName={token.name} chainSymbol={token.logoUrl} />
                                ))}
                            </div>
                        }
                    />

                    <div className="flex w-full items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Icon name="info" size={18} className="text-grey-1" />
                            <p className="text-sm text-grey-1">Min deposit for EVM networks</p>
                        </div>

                        <p className="text-sm font-medium text-grey-1">{depositAddressData.minDepositLimitUsd} USD</p>
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
                </div>
            )}
        </div>
    )
}

export default RhinoDepositView

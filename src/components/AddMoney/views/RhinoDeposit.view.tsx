'use client'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import Card from '@/components/Global/Card'
import CopyToClipboard, { type CopyToClipboardRef } from '@/components/Global/CopyToClipboard'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import ChainChip from '../components/ChainChip'
import InfoCard from '@/components/Global/InfoCard'
import { Root, List, Trigger } from '@radix-ui/react-tabs'
import Loading from '@/components/Global/Loading'
import CyclingLoading from '@/components/Global/Loading/CyclingLoading'
import { useRef } from 'react'
import { useCryptoDepositPolling } from '../hooks/useCryptoDepositPolling'
import type { CreateDepositAddressResponse, RhinoChainType } from '@/services/services.types'
import { useAutoTruncatedAddress } from '@/hooks/useAutoTruncatedAddress'
import { CHAIN_LOGOS, SUPPORTED_EVM_CHAINS, NETWORK_LABELS, getSupportedTokens } from '@/constants/rhino.consts'
import UserCard from '@/components/User/UserCard'
import { isCryptoAddress, printableAddress } from '@/utils/general.utils'
import { useTranslations } from 'next-intl'

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
    const t = useTranslations('addMoney.crypto')
    const tCommon = useTranslations('common')
    const copyRef = useRef<CopyToClipboardRef>(null)
    const {
        status: depositAddressStatus,
        resetStatus,
        isResetting,
    } = useCryptoDepositPolling(depositAddressData?.depositAddress, onSuccess)

    const { containerRef, truncatedAddress } = useAutoTruncatedAddress(depositAddressData?.depositAddress ?? '')

    const amountLimitsTitle = chainType === 'EVM' ? t('evmNetworks') : NETWORK_LABELS[chainType]

    if (depositAddressStatus === 'failed') {
        return (
            <div className="flex min-h-[inherit] w-full flex-col justify-start gap-8 pb-5 md:pb-0">
                <NavHeader title={headerTitle} onPrev={onBack} />

                <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4">
                    <Card>
                        <div className="flex w-full flex-col items-center justify-center gap-2">
                            <IconBubble icon="alert" size="s" color="yellow" />
                            <h1 className="text-heading-card text-foreground-primary">{t('marketMovedTitle')}</h1>

                            <p className="text-center text-body-s text-foreground-secondary">
                                {t('marketMovedDescription')}
                            </p>

                            <p className="text-center text-body-s font-bold text-foreground-secondary">
                                {t('marketMovedNote')}
                            </p>
                        </div>
                    </Card>
                    <Button onClick={resetStatus} shadowSize="4" loading={isResetting} disabled={isResetting}>
                        {tCommon('tryAgain')}
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex w-full flex-col justify-start gap-8 pb-5 md:pb-0">
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
                    <List
                        className="flex w-full items-center rounded-sm bg-background-default p-0"
                        aria-label={t('selectNetworkType')}
                    >
                        <Trigger
                            value="EVM"
                            className="flex-1 rounded-sm border border-transparent py-1.5 text-body-s font-medium text-foreground-secondary transition-all duration-fast data-[state=active]:border-action-primary data-[state=active]:bg-action-primary/10 data-[state=active]:text-action-primary"
                        >
                            EVM
                        </Trigger>
                        <Trigger
                            value="SOL"
                            className="flex-1 rounded-sm border border-transparent py-1.5 text-body-s font-medium text-foreground-secondary transition-all duration-fast data-[state=active]:border-action-primary data-[state=active]:bg-action-primary/10 data-[state=active]:text-action-primary"
                        >
                            Solana
                        </Trigger>
                        <Trigger
                            value="TRON"
                            className="flex-1 rounded-sm border border-transparent py-1.5 text-body-s font-medium text-foreground-secondary transition-all duration-fast data-[state=active]:border-action-primary data-[state=active]:bg-action-primary/10 data-[state=active]:text-action-primary"
                        >
                            Tron
                        </Trigger>
                    </List>
                </Root>

                {(isDepositAddressDataLoading || depositAddressStatus === 'loading') && (
                    <div className="flex h-[60vh] items-center justify-center">
                        {depositAddressStatus === 'loading' ? <CyclingLoading /> : <Loading variant="mascot" />}
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
                            <p className="w-full text-body-s" ref={containerRef}>
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
                                    <p className="text-body-s">{t('supportedTokensInline')}</p>
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

                        <div className="flex w-full flex-col gap-1">
                            <div className="flex w-full items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Icon name="info" size={18} className="text-foreground-secondary" />
                                    <p className="text-body-s text-foreground-secondary">
                                        {t('minDepositForLabel', { network: amountLimitsTitle })}
                                    </p>
                                </div>

                                <p className="text-body-s font-medium text-foreground-secondary">
                                    {depositAddressData.minDepositLimitUsd} USD
                                </p>
                            </div>

                            <div className="flex w-full items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Icon name="info" size={18} className="text-foreground-secondary" />
                                    <p className="text-body-s text-foreground-secondary">
                                        {t('maxDepositForLabel', { network: amountLimitsTitle })}
                                    </p>
                                </div>

                                <p className="text-body-s font-medium text-foreground-secondary">
                                    {depositAddressData.maxDepositLimitUsd} USD
                                </p>
                            </div>
                        </div>

                        {chainType === 'EVM' && (
                            <Card className="space-y-2 p-4">
                                <h3 className="text-body-s font-bold text-foreground-primary">
                                    {t('supportedEvmNetworks')}
                                </h3>
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

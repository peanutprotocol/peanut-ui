'use client'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import Card from '@/components/Global/Card'
import CopyToClipboard, { type CopyToClipboardRef } from '@/components/Global/CopyToClipboard'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import ChainChip from '../components/ChainChip'
import { Notification } from '@/components/0_Bruddle/Notification'
import SegmentedControl from '@/components/0_Bruddle/SegmentedControl'
import Loading from '@/components/Global/Loading'
import CyclingLoading from '@/components/Global/Loading/CyclingLoading'
import { useRef } from 'react'
import { useCryptoDepositPolling } from '../hooks/useCryptoDepositPolling'
import type { CreateDepositAddressResponse, RhinoChainType } from '@/services/services.types'
import { useAutoTruncatedAddress } from '@/hooks/useAutoTruncatedAddress'
import { CHAIN_LOGOS, SUPPORTED_EVM_CHAINS, NETWORK_LABELS, getSupportedTokens } from '@/constants/rhino.consts'
import UserCard from '@/components/User/UserCard'
import { isCryptoAddress, printableAddress } from '@/utils/general.utils'
import { isBelowRhinoMinDeposit } from '@/utils/withdraw.utils'
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
    const tPayment = useTranslations('payment')
    const copyRef = useRef<CopyToClipboardRef>(null)
    const {
        status: depositAddressStatus,
        resetStatus,
        isResetting,
    } = useCryptoDepositPolling(depositAddressData?.depositAddress, onSuccess)

    const { containerRef, truncatedAddress } = useAutoTruncatedAddress(depositAddressData?.depositAddress ?? '')

    const amountLimitsTitle = chainType === 'EVM' ? t('evmNetworks') : NETWORK_LABELS[chainType]

    /*
     * Fixed-amount flows (request payments pass `amount`) below the chain's SDA
     * floor must be blocked here, where the per-chain floor is first known:
     * Rhino accepts a sub-minimum deposit on-chain but never bridges it, so the
     * funds strand uncredited. The chain tabs stay usable — another chain may
     * have a lower floor.
     */
    const isBelowMinDeposit =
        amount != null && isBelowRhinoMinDeposit(amount.toString(), depositAddressData?.minDepositLimitUsd)

    if (depositAddressStatus === 'failed') {
        return (
            <div className="flex min-h-inherit w-full flex-col justify-start gap-8 pb-4 md:pb-0">
                <NavHeader title={headerTitle} onPrev={onBack} />

                <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4">
                    <Card>
                        <div className="flex w-full flex-col items-center justify-center gap-2">
                            <IconBubble icon="alert" size="s" color="yellow" />
                            <h1 className="text-heading-card text-foreground-primary">{t('marketMovedTitle')}</h1>

                            <p className="text-center text-body-s text-foreground-secondary">
                                {t('marketMovedDescription')}
                            </p>

                            <p className="text-center text-label-l text-foreground-secondary">{t('marketMovedNote')}</p>
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
        <div className="flex w-full flex-col justify-start gap-8 pb-4 md:pb-0">
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
                <SegmentedControl
                    options={[
                        { value: 'EVM', label: 'EVM' },
                        { value: 'SOL', label: 'Solana' },
                        { value: 'TRON', label: 'Tron' },
                    ]}
                    value={chainType}
                    onChange={(v) => setChainType(v as RhinoChainType)}
                    fullWidth
                    aria-label={t('selectNetworkType')}
                />

                {(isDepositAddressDataLoading || depositAddressStatus === 'loading') && (
                    <div className="flex h-[60vh] items-center justify-center">
                        {depositAddressStatus === 'loading' ? <CyclingLoading /> : <Loading variant="mascot" />}
                    </div>
                )}

                {depositAddressData &&
                    !isDepositAddressDataLoading &&
                    depositAddressStatus !== 'loading' &&
                    isBelowMinDeposit && (
                        <Card>
                            <div className="flex w-full flex-col items-center justify-center gap-2">
                                <IconBubble icon="alert" color="yellow" size="s" />
                                <h1 className="text-heading-card">{tPayment('minAmount.title')}</h1>
                                <p className="text-center text-body-s text-foreground-secondary">
                                    {tPayment('minAmount.description', {
                                        minAmount: depositAddressData.minDepositLimitUsd,
                                    })}
                                </p>
                            </div>
                        </Card>
                    )}

                {depositAddressData &&
                    !isDepositAddressDataLoading &&
                    depositAddressStatus !== 'loading' &&
                    !isBelowMinDeposit && (
                        <>
                            <div className="flex items-center justify-center">
                                <QRCodeWrapper url={depositAddressData?.depositAddress} />
                            </div>

                            <Button
                                variant="primary-soft"
                                className="flex h-8 w-2/3 cursor-pointer items-center justify-center gap-1 rounded-full px-3 md:h-9 md:px-4"
                                shadowSize="3"
                                size="small"
                                onClick={() => copyRef.current?.copy()}
                            >
                                <p className="w-full text-body-s" ref={containerRef}>
                                    {truncatedAddress}
                                </p>
                                {/* the row Button IS the copy control — the glyph
                                    must not nest a second <button> */}
                                <CopyToClipboard
                                    ref={copyRef}
                                    type="icon"
                                    interactive={false}
                                    textToCopy={depositAddressData.depositAddress}
                                />
                            </Button>

                            <Notification priority="attention">
                                <div className="flex items-center gap-2">
                                    <p>{t('supportedTokensInline')}</p>
                                    {getSupportedTokens(chainType).map((token) => (
                                        <ChainChip
                                            key={token.name}
                                            chainName={token.name}
                                            chainSymbol={token.logoUrl}
                                        />
                                    ))}
                                </div>
                            </Notification>

                            <div className="flex w-full flex-col gap-1">
                                <div className="flex w-full items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Icon name="info" size={16} className="text-foreground-secondary" />
                                        <p className="text-body-s text-foreground-secondary">
                                            {t('minDepositForLabel', { network: amountLimitsTitle })}
                                        </p>
                                    </div>

                                    <p className="text-body-s text-foreground-secondary">
                                        {depositAddressData.minDepositLimitUsd} USD
                                    </p>
                                </div>

                                <div className="flex w-full items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Icon name="info" size={16} className="text-foreground-secondary" />
                                        <p className="text-body-s text-foreground-secondary">
                                            {t('maxDepositForLabel', { network: amountLimitsTitle })}
                                        </p>
                                    </div>

                                    <p className="text-body-s text-foreground-secondary">
                                        {depositAddressData.maxDepositLimitUsd} USD
                                    </p>
                                </div>
                            </div>

                            {chainType === 'EVM' && (
                                <Card className="space-y-2 p-4">
                                    <h3 className="text-label-l text-foreground-primary">
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

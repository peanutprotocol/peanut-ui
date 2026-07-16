'use client'

import { Button } from '@/components/0_Bruddle/Button'
import AddressLink from '@/components/Global/AddressLink'
import Card from '@/components/Global/Card'
import DisplayIcon from '@/components/Global/DisplayIcon'
import ErrorAlert from '@/components/Global/ErrorAlert'
import InfoCard from '@/components/Global/InfoCard'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { useTokenChainIcons } from '@/hooks/useTokenChainIcons'
import { type ITokenPriceData } from '@/interfaces'
import { formatAmount, isStableCoin } from '@/utils/general.utils'
import { INSUFFICIENT_BALANCE_MESSAGE } from '@/utils/balance.utils'
import type { ChainWithTokens } from '@/interfaces/chain-meta'
import { useMemo } from 'react'
import { ROUTE_NOT_FOUND_ERROR } from '@/constants/general.consts'
import { useTranslations } from 'next-intl'

interface WithdrawConfirmViewProps {
    amount: string
    token: ITokenPriceData
    chain: ChainWithTokens
    toAddress: string
    networkFee?: number
    peanutFee?: string
    onConfirm: () => void
    onBack: () => void
    isProcessing?: boolean
    error?: string | null
    isCrossChain?: boolean
    /** True while the shared `useCrossChainTransfer` hook is provisioning the SDA / previewing fees. */
    isCalculating?: boolean
    /**
     * Decimal receive amount from Rhino's public quote — e.g. "99.95". Nullable
     * for same-chain (no bridge) or while the preview call is in flight. Under
     * SDA there's no slippage on same-stablecoin bridges; this is the deterministic
     * "they'll receive X" number.
     */
    receiveAmount?: string | null
    /**
     * The exact USDC the kernel spends (decimal string) — the honest "You pay".
     * SDA (receive mode) = principal + fee; bridge (pay mode) = principal (the
     * fee comes out of what the recipient receives). Nullable while calculating.
     */
    payAmount?: string | null
    /**
     * True when the bridge fee is a large share of the amount (e.g. a small
     * withdraw to Ethereum mainnet where the flat gas floor dominates). Shows a
     * non-blocking heads-up — the user can still proceed; the fee is honest.
     */
    showHighFeeWarning?: boolean
    /**
     * True when the balance can't cover amount + cross-chain fee. Blocks the CTA
     * with an honest "not enough balance" message instead of letting the user
     * sign into the misleading "balance still settling" send error.
     */
    insufficientBalance?: boolean
}

export default function ConfirmWithdrawView({
    amount,
    token,
    chain,
    toAddress,
    networkFee = 0,
    peanutFee = '0.00',
    onConfirm,
    onBack,
    isProcessing,
    error,
    isCrossChain = false,
    isCalculating = false,
    receiveAmount,
    payAmount,
    showHighFeeWarning = false,
    insufficientBalance = false,
}: WithdrawConfirmViewProps) {
    const t = useTranslations('withdraw')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const tLoading = useTranslations('loadingStates')
    const { tokenIconUrl, chainIconUrl, resolvedChainName, resolvedTokenSymbol } = useTokenChainIcons({
        chainId: chain.chainId,
        tokenAddress: token.address,
        tokenSymbol: token.symbol,
    })

    const displayReceived = useMemo<string | null>(() => {
        if (!isCrossChain || !receiveAmount || !resolvedTokenSymbol) return null
        return isStableCoin(resolvedTokenSymbol) ? `$${receiveAmount}` : `${receiveAmount} ${resolvedTokenSymbol}`
    }, [isCrossChain, receiveAmount, resolvedTokenSymbol])

    // Honest bridge fee. The Rhino fee (destination gas + 0.07%) is paid by the
    // user on top of the amount — it is NOT sponsored. Only the kernel execution
    // gas is sponsored by Peanut's paymaster (the "Peanut fee" row below). For
    // same-chain (no bridge) there's no Rhino fee, so it stays sponsored.
    const networkFeeDisplay = useMemo<string>(() => {
        if (!isCrossChain || networkFee <= 0) return t('confirm.sponsoredByPeanut')
        return networkFee < 0.01 ? '< $0.01' : `$${networkFee.toFixed(2)}`
    }, [isCrossChain, networkFee, t])

    // What actually leaves the wallet on a cross-chain withdraw — the exact USDC
    // the kernel spends (`payAmount`). This is authoritative for BOTH paths and
    // avoids guessing: SDA (receive mode) = principal + fee, bridge (pay mode) =
    // principal (the fee comes out of the recipient's amount, not on top). Using
    // amount + fee would over-state the bridge path (showing principal + fee when
    // the user only pays the principal).
    const totalPayDisplay = useMemo<string | null>(() => {
        if (!isCrossChain || !payAmount) return null
        const parsed = parseFloat(payAmount)
        return Number.isFinite(parsed) ? `$${formatAmount(payAmount)}` : null
    }, [isCrossChain, payAmount])

    return (
        <div className="space-y-8">
            <NavHeader title={tNav('withdraw')} onPrev={onBack} />

            <div className="space-y-4 pb-5">
                <PeanutActionDetailsCard
                    avatarSize="small"
                    transactionType={'WITHDRAW'}
                    recipientType="USERNAME"
                    recipientName={''}
                    amount={formatAmount(amount)}
                    tokenSymbol="USDC"
                />

                <Card className="rounded-sm">
                    {isCrossChain && (isCalculating || displayReceived) && (
                        <PaymentInfoRow
                            label={t('confirm.recipientReceives')}
                            value={displayReceived}
                            loading={isCalculating}
                            moreInfoText={t('confirm.recipientReceivesInfo')}
                        />
                    )}
                    <PaymentInfoRow
                        label={t('confirm.tokenAndNetwork')}
                        value={
                            <div className="flex items-center gap-2">
                                {token && (
                                    <div className="relative flex h-6 w-6 min-w-[24px] items-center justify-center">
                                        <DisplayIcon
                                            iconUrl={tokenIconUrl}
                                            altText={resolvedTokenSymbol || t('confirm.tokenAlt')}
                                            fallbackName={resolvedTokenSymbol || 'T'}
                                            sizeClass="h-6 w-6"
                                        />
                                        {chainIconUrl && (
                                            <div className="absolute -bottom-1 -right-1">
                                                <DisplayIcon
                                                    iconUrl={chainIconUrl}
                                                    altText={resolvedChainName || t('confirm.chainAlt')}
                                                    fallbackName={resolvedChainName || 'C'}
                                                    sizeClass="h-3.5 w-3.5"
                                                    className="rounded-full border-2 border-white dark:border-grey-4"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                                <span>
                                    {t.rich('confirm.tokenOnChain', {
                                        token: resolvedTokenSymbol || token.symbol,
                                        chain: resolvedChainName || chain.networkName,
                                        c: (chunks) => <span className="capitalize">{chunks}</span>,
                                    })}
                                </span>
                            </div>
                        }
                    />
                    <PaymentInfoRow
                        label={t('confirm.to')}
                        value={<AddressLink isLink={false} address={toAddress} className="text-black no-underline" />}
                    />
                    <PaymentInfoRow
                        label={t('confirm.networkFee')}
                        value={networkFeeDisplay}
                        loading={isCrossChain && isCalculating}
                        moreInfoText={t('confirm.networkFeeInfo')}
                    />
                    {isCrossChain && (isCalculating || totalPayDisplay) && (
                        <PaymentInfoRow label={t('confirm.youPay')} value={totalPayDisplay} loading={isCalculating} />
                    )}
                    <PaymentInfoRow hideBottomBorder label={t('confirm.peanutFee')} value={`$${peanutFee}`} />
                </Card>

                {showHighFeeWarning && (
                    <InfoCard variant="info" icon="info" description={t('confirm.highFeeWarning')} />
                )}

                {error ? (
                    <Button
                        variant="purple"
                        shadowSize="4"
                        onClick={() => {
                            if (error === ROUTE_NOT_FOUND_ERROR) {
                                onBack()
                            } else {
                                onConfirm()
                            }
                        }}
                        disabled={false}
                        loading={false}
                        className="w-full"
                        icon="retry"
                    >
                        {tCommon('retry')}
                    </Button>
                ) : (
                    <Button
                        variant="purple"
                        shadowSize="4"
                        onClick={onConfirm}
                        disabled={isProcessing || isCalculating || insufficientBalance}
                        loading={isProcessing}
                        className="w-full"
                    >
                        {isProcessing ? tLoading('withdrawing') : tNav('withdraw')}
                    </Button>
                )}

                {insufficientBalance && !error && <ErrorAlert description={INSUFFICIENT_BALANCE_MESSAGE} />}
                {error && <ErrorAlert description={error} />}
            </div>
        </div>
    )
}

'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Card } from '@/components/0_Bruddle/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import DocsLink from '@/components/Global/DocsLink'
import { CHAIN_REGISTRY } from '@/constants/chainRegistry.consts'
import { formatAmountNumber } from '@/utils/currency'
import type { FxFeeSchedule } from '@/utils/fx.utils'

interface FeesScheduleViewProps {
    schedule: FxFeeSchedule
}

const CHAIN_DISPLAY_NAMES: Readonly<Record<string, string>> = {
    ARBITRUM: 'Arbitrum',
    BASE: 'Base',
    OPTIMISM: 'Optimism',
    POLYGON: 'Polygon',
    BNB: 'BNB',
    GNOSIS: 'Gnosis',
    AVALANCHE: 'Avalanche',
    LINEA: 'Linea',
    MANTLE: 'Mantle',
    TEMPO: 'Tempo',
    SOLANA: 'Solana',
    TRON: 'Tron',
    ETHEREUM: 'Ethereum',
}

function formatMoneyFee(amountStr: string, symbol: string, locale: string): string {
    const n = Number(amountStr)
    if (!Number.isFinite(n) || n === 0) return `${symbol}0`
    const hasCents = Math.abs(n % 1) > 1e-6
    return `${symbol}${formatAmountNumber(n, hasCents ? 2 : 0, hasCents ? 2 : 0, locale)}`
}

function formatCryptoNetworkFee(flatFeeUsd: string, pctFee: string): string {
    const pct = Number(pctFee) * 100
    const pctFormatted = Number.isFinite(pct) ? pct.toFixed(2).replace(/0+$/, '').replace(/\.$/, '') : '0'
    return `$${flatFeeUsd} + ${pctFormatted}%`
}

/**
 * Derive a clean representative list of `$0` withdrawal chains straight from
 * `CHAIN_REGISTRY` (excluding the network-fee chains), so adding/removing a
 * chain in the registry keeps the Fees tab honest without hardcoding a count.
 */
function buildSponsoredChainsPreview(feeChains: ReadonlySet<string>): string {
    const names: string[] = []
    for (const entry of CHAIN_REGISTRY) {
        if (!entry.rhinoName || !entry.withdraw) continue
        if (feeChains.has(entry.rhinoName)) continue
        const key = entry.displayName ?? entry.rhinoName
        const label = CHAIN_DISPLAY_NAMES[key]
        if (label && !names.includes(label)) names.push(label)
    }
    return names.slice(0, 10).join(', ')
}

export function FeesScheduleView({ schedule }: FeesScheduleViewProps) {
    const t = useTranslations('exchangeRate.fees')
    const locale = useLocale()

    const byId = new Map(schedule.bankTransfers.map((row) => [row.id, row]))
    const usdAchFee = formatMoneyFee(byId.get('usd-ach-out')?.flatFee ?? '0', '$', locale)
    const usdWireFee = formatMoneyFee(byId.get('usd-wire-out')?.flatFee ?? '20.00', '$', locale)
    const eurSepaFee = formatMoneyFee(byId.get('eur-sepa')?.flatFee ?? '0', '€', locale)
    const pixBrRaw = Number(byId.get('brl-pix-br')?.flatFee ?? '0.75')
    const pixBrFee = `R$ ${formatAmountNumber(pixBrRaw, 2, 2, locale)}`

    const feeChains = new Set(schedule.crypto.networkFeeWithdrawals.map((row) => row.chain.toUpperCase()))
    const sponsoredChainsPreview = buildSponsoredChainsPreview(feeChains)

    return (
        <div className="flex flex-col gap-4">
            {/* Bank transfers & Pix */}
            <div className="flex flex-col gap-2">
                <h2 className="px-0.5 text-label-l text-foreground-primary">{t('sections.bankTransfers')}</h2>
                <Card className="divide-y divide-dashed divide-border-default px-4">
                    <DataRow label="USD · ACH / FedNow" value={usdAchFee} />
                    <DataRow label={t('rows.usdWireOut')} value={usdWireFee} />
                    <DataRow label="EUR · SEPA" value={eurSepaFee} />
                    <DataRow label="GBP · MXN · COP · ARS" value="$0" />
                    <DataRow label={t('rows.brlPixBr')} value={pixBrFee} />
                </Card>
                <p className="px-0.5 text-body-xs text-foreground-secondary">
                    {t('notes.bankTransfers', { wireFee: usdWireFee, pixFee: pixBrFee })}
                </p>
            </div>

            {/* Peanut Card (Visa) */}
            <div className="flex flex-col gap-2">
                <h2 className="px-0.5 text-label-l text-foreground-primary">{t('sections.card')}</h2>
                <Card className="divide-y divide-dashed divide-border-default px-4">
                    <DataRow label={t('rows.cardIssuance')} value="$0" />
                    <DataRow label={t('rows.cardPayments')} value={`${schedule.card.peanutPaymentFeePct}%`} />
                </Card>
                <p className="px-0.5 text-body-xs text-foreground-secondary">{t('notes.cardVisa')}</p>
            </div>

            {/* Crypto (deposits & withdrawals) */}
            <div className="flex flex-col gap-2">
                <h2 className="px-0.5 text-label-l text-foreground-primary">{t('sections.crypto')}</h2>
                <Card className="divide-y divide-dashed divide-border-default px-4">
                    <DataRow label={t('rows.cryptoDeposits')} value="$0" />
                    <DataRow label={t('rows.cryptoL2Withdrawals')} value="$0" />
                    {schedule.crypto.networkFeeWithdrawals.map((row) => (
                        <DataRow
                            key={row.chain}
                            label={CHAIN_DISPLAY_NAMES[row.chain.toUpperCase()] ?? row.chain}
                            value={formatCryptoNetworkFee(row.flatFeeUsd, row.pctFee)}
                        />
                    ))}
                </Card>
                <p className="px-0.5 text-body-xs text-foreground-secondary">
                    {t('notes.cryptoNetworks', { networks: sponsoredChainsPreview })}
                </p>
            </div>

            <div className="pt-1 text-center">
                <DocsLink href="/en/help/fees-pricing" className="text-body-xs text-foreground-secondary underline">
                    {t('fullScheduleLink')}
                </DocsLink>
            </div>
        </div>
    )
}

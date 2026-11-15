'use client'

import { formatFiniteDisplay } from '@/utils/currency'

import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import Card from '@/components/Global/Card'
import ProgressBar from '@/components/0_Bruddle/ProgressBar'
import { getCurrencySymbol, getLimitColorClass, getLimitData } from '@/features/limits/utils'
import type { AveniaLimits, MantecaLimit, BridgeLimits } from '@/interfaces/interfaces'
import type { RailOperation } from '@/types/capabilities'
import MonthlyRoomCard from '@/features/limits/components/MonthlyRoomCard'
import type { UnlockRow } from '@/utils/unlock-payments.utils'
import { useTranslations } from 'next-intl'

/**
 * Per-corridor limit facts for the Accounts & payments screen. Rendered in ONE
 * place: the row's own details drawer (`MoneySettings.view`). The standing
 * cards that used to sit under each list were removed on 2026-09-21 — a limit
 * belongs to a corridor, so it is stated where that corridor is explained.
 * Legacy bank-transfer limits do not apply to reusable deposit accounts, so
 * this only ever covers the KYC-unlock bank/QR rows.
 */
export type RowLimitSummary =
    | { kind: 'manteca'; asset: string; remaining: string; limit: string; usedPercent: number }
    | { kind: 'bridge'; direction: 'deposit' | 'withdrawal'; perTransaction: string }
    | { kind: 'room'; currency: string; room: AveniaLimits; operations: RailOperation[] }

/**
 * BRL's limits when a Pix route of the user names Avenia: Avenia's monthly room, for the operations it
 * serves (`brlOperationsServedBy`), and whether Manteca's BRL limit still applies to another one
 * (`mantecaBrlLimitApplies`: a QR payment outside Avenia's QR gate). An unread room shows no Avenia line.
 */
export interface BrlRoom {
    room: AveniaLimits | null
    operations: RailOperation[]
    mantecaToo: boolean
}

// Whole-unit cap with locale grouping ($100,000, not $100000): the shared
// formatter only abbreviates from seven digits and never groups.
function formatCap(amount: number, currency: string, locale: string): string {
    const symbol = getCurrencySymbol(currency)
    const separator = symbol.length > 1 && symbol === symbol.toUpperCase() ? ' ' : ''
    return `${symbol}${separator}${formatFiniteDisplay(amount, locale, { maximumFractionDigits: 0 })}`
}

export function limitSummariesForRows(
    rows: readonly UnlockRow[],
    mantecaLimits: MantecaLimit[] | null,
    bridgeLimits: BridgeLimits | null,
    locale: string,
    brlRoom: BrlRoom | null = null
): RowLimitSummary[] {
    const refs = new Set(rows.filter((row) => row.chip === 'active').flatMap((row) => row.limitRefs ?? []))
    const summaries: RowLimitSummary[] = []
    for (const ref of refs) {
        if (ref === 'bridge') {
            for (const [direction, rawCap] of [
                ['deposit', bridgeLimits?.onRampPerTransaction],
                ['withdrawal', bridgeLimits?.offRampPerTransaction],
            ] as const) {
                const cap = Number(rawCap)
                if (bridgeLimits && Number.isFinite(cap) && cap > 0) {
                    summaries.push({
                        kind: 'bridge',
                        direction,
                        perTransaction: formatCap(cap, bridgeLimits.asset || 'USD', locale),
                    })
                }
            }
            continue
        }
        if (ref === 'BRL' && brlRoom) {
            const { room, operations, mantecaToo } = brlRoom
            if (room) summaries.push({ kind: 'room', currency: room.currency, room, operations })
            if (!mantecaToo) continue
        }
        const limit = mantecaLimits?.find((l) => l.asset === ref)
        if (limit) {
            const monthly = getLimitData(limit, 'monthly')
            summaries.push({
                kind: 'manteca',
                asset: ref,
                remaining: formatCap(monthly.remaining, ref, locale),
                limit: formatCap(monthly.limit, ref, locale),
                usedPercent: monthly.limit > 0 ? (monthly.remaining / monthly.limit) * 100 : 0,
            })
        }
    }
    return summaries
}

export function MethodLimits({ noLimit, summaries }: { noLimit: boolean; summaries: RowLimitSummary[] }) {
    const t = useTranslations('profile.unlockPayments')
    if (!noLimit && summaries.length === 0) return null

    // A monthly limit needs the label + used-bar shape (ListItem body + ProgressBar);
    // a per-transfer bank cap is a plain labelled value, so it reads as a receipt row.
    const mantecaSummaries = summaries.filter(
        (s): s is Extract<RowLimitSummary, { kind: 'manteca' }> => s.kind === 'manteca'
    )
    const bridgeSummaries = summaries.filter(
        (s): s is Extract<RowLimitSummary, { kind: 'bridge' }> => s.kind === 'bridge'
    )
    const roomSummaries = summaries.filter((s): s is Extract<RowLimitSummary, { kind: 'room' }> => s.kind === 'room')

    return (
        <>
            {(noLimit || mantecaSummaries.length > 0) && (
                <ListGroup>
                    {noLimit && <ListItem title={t('limits.p2pNoLimit')} />}
                    {mantecaSummaries.map((summary) => (
                        <ListItem
                            key={summary.asset}
                            title={summary.asset}
                            truncate
                            body={
                                <div className="flex flex-col gap-2">
                                    <span>
                                        {t('limits.monthlyLeft', {
                                            remaining: summary.remaining,
                                            limit: summary.limit,
                                        })}
                                    </span>
                                    <ProgressBar
                                        value={summary.usedPercent}
                                        fillClassName={getLimitColorClass(summary.usedPercent, 'bg')}
                                    />
                                </div>
                            }
                            bodyWrap
                        />
                    ))}
                </ListGroup>
            )}
            {/* Per-transfer bank caps are labelled values: the DS DataRow-in-Card
                receipt recipe (same as DepositDetailsCard) — label left, value right —
                replaces the hand-rolled ListItem title/trailing pair. The card owns the
                dashed dividers; DataRow draws no border of its own. */}
            {bridgeSummaries.length > 0 && (
                <Card position="solo" className="divide-y divide-dashed divide-border-default px-4 py-0">
                    {bridgeSummaries.map((summary) => (
                        <DataRow
                            key={summary.direction}
                            label={t(
                                summary.direction === 'deposit'
                                    ? 'limits.depositPerTransfer'
                                    : 'limits.withdrawalPerTransfer'
                            )}
                            value={summary.perTransaction}
                        />
                    ))}
                </Card>
            )}
            {roomSummaries.map((summary) => (
                <MonthlyRoomCard
                    key={summary.currency}
                    currency={summary.currency}
                    room={summary.room}
                    operations={summary.operations}
                />
            ))}
        </>
    )
}

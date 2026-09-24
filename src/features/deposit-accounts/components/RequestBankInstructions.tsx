'use client'

import { DataRow } from '@/components/0_Bruddle/DataRow'
import Card from '@/components/Global/Card'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Section } from '@/components/0_Bruddle/Section'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import type { RequestDepositInstructions } from '@/services/services.types'
import { useFormatter, useTranslations } from 'next-intl'
import { instructionRows } from '../instructionRows'
import { bankPayAmountFigure, readServerPayerAmount, resolveBankPayAmount } from '../payerAmount'
import { corridorFromRailId } from '../rails'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { DepositDetailsCard } from './DepositDetailsCard'

/**
 * The requester's bank details, shown to the payer of one request.
 *
 * The details card is the SAME one the account holder reads on their own
 * details screen, built from the same `instructionRows`. A payer and a holder
 * looking at one account must never see two different sets of numbers.
 *
 * Two things this screen adds, and the payment depends on both. The amount is
 * stated in the account's own currency, because a payer typing a dollar figure
 * into a euro transfer sends the wrong money. The reference is what connects
 * the deposit to this request: without it the money still credits the
 * requester, but the request stays open.
 */
export function RequestBankInstructions({
    instructions,
    usdAmount,
    remainingUsd,
    serverCountsAllPayments,
}: {
    instructions: RequestDepositInstructions
    /** what THIS payer entered, in dollars — their own contribution, which can be less than the request */
    usdAmount?: string
    /** what the request still needs, in dollars; undefined on an open-amount request */
    remainingUsd?: number
    /** false when the API's remainder misses money the screen has counted — see `resolveBankPayAmount` */
    serverCountsAllPayments?: boolean
}) {
    const t = useTranslations('payment')
    const format = useFormatter()
    const { t: tDeposit, rowLabels, railLabels, arrivalDetail, senderLimit } = useDepositAccountCopy()
    const account = instructions.depositAccount
    const accountCurrency = account.currency.toUpperCase()

    // The API's figure knows the rate it used and whether it is exact, so it
    // beats a client-side conversion. The client rate is read only for an API
    // that sends no figure for this account's currency.
    const serverAmount = readServerPayerAmount(instructions.payerAmount)
    const hasServerAmount = serverAmount?.currency === accountCurrency
    const { exchangeRate } = useExchangeRate({
        sourceCurrency: 'USD',
        destinationCurrency: accountCurrency,
        enabled: !hasServerAmount && accountCurrency !== 'USD',
    })

    const rows = account.instructions ? instructionRows(account.instructions, rowLabels, railLabels) : []
    const corridor = corridorFromRailId(account.railId)
    const amount = resolveBankPayAmount({
        server: serverAmount,
        payerUsd: usdAmount,
        remainingUsd,
        serverCountsAllPayments,
        accountCurrency,
        clientRate: exchangeRate,
    })

    // Only an exact figure in the account's currency is copyable. A payer who
    // pastes an estimate sends a number nobody promised would settle the request.
    let amountRow: { text: string; copyValue?: string; note?: string } | undefined
    if (amount) {
        const { value, currency, digits, approx } = bankPayAmountFigure(amount)
        const text = t(approx ? 'bankTransfer.amountValueApprox' : 'bankTransfer.amountValue', {
            amount: format.number(value, { minimumFractionDigits: digits, maximumFractionDigits: digits }),
            currency,
        })
        if (amount.kind === 'usd-only') {
            amountRow = {
                text,
                note: t('bankTransfer.amountNoteBankConverts', { currency: amount.accountCurrency }),
            }
        } else if (approx) {
            amountRow = { text, note: t('bankTransfer.amountNote') }
        } else {
            amountRow = {
                text,
                copyValue: value.toFixed(digits),
                note: amount.settlesRequest ? t('bankTransfer.amountNoteSameCurrency') : undefined,
            }
        }
    }

    // Who may pay this account, first: a friend paying a business-only account
    // has their transfer returned. The same rule the requester reads before
    // sharing the link.
    const senderNote = senderLimit(account.matching)?.payer

    return (
        <div className="flex flex-col gap-4">
            {senderNote && <Callout priority="attention">{senderNote}</Callout>}

            <Section title={tDeposit('details.sectionTitle')}>
                <DepositDetailsCard rows={rows} />
            </Section>

            {/* Amount and reference share one card: they are the two values the
                payer types into their bank, and two cards read as two tasks. */}
            <Section title={t('bankTransfer.transferSection')}>
                <Card position="solo" className="divide-y divide-dashed divide-border-default px-4 py-0">
                    {amountRow && (
                        <DataRow
                            label={t('bankTransfer.amountLabel')}
                            value={amountRow.text}
                            allowCopy={amountRow.copyValue !== undefined}
                            copyValue={amountRow.copyValue}
                        />
                    )}
                    <DataRow
                        label={t('bankTransfer.referenceLabel')}
                        value={instructions.paymentReference}
                        allowCopy={true}
                    />
                </Card>
                {amountRow?.note && <p className="text-body-s text-foreground-secondary">{amountRow.note}</p>}
                <Callout priority="attention">{t('bankTransfer.referenceNote')}</Callout>
            </Section>

            {corridor && <p className="text-body-s text-foreground-secondary">{arrivalDetail(corridor)}</p>}
        </div>
    )
}

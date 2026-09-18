'use client'

import { DataRow } from '@/components/0_Bruddle/DataRow'
import Card from '@/components/Global/Card'
import { Notification } from '@/components/0_Bruddle/Notification'
import { Section } from '@/components/0_Bruddle/Section'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import type { RequestDepositInstructions } from '@/services/services.types'
import { useFormatter, useTranslations } from 'next-intl'
import { instructionRows } from '../instructionRows'
import { minorUnitDigits, payerAmount } from '../payerAmount'
import { corridorFromRailId } from '../rails'
import type { SenderPolicy } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { DepositDetailsCard } from './DepositDetailsCard'

/**
 * The payer-facing warning for a corridor that does not take everyone's money.
 * `anyone` needs none; `own-name-only` never reaches a payer (it is not
 * shareable). Same rule the requester reads before sharing the link.
 */
const SENDER_NOTE_KEY: Partial<Record<SenderPolicy, string>> = {
    'business-only': 'bankTransfer.senderBusinessOnly',
    unknown: 'bankTransfer.senderUnknown',
}

/**
 * The requester's bank details, shown to the payer of one request.
 *
 * The details card is the SAME one the account holder reads on their own
 * details screen, built from the same `instructionRows`. A payer and a holder
 * looking at one account must never see two different sets of numbers.
 *
 * Two things this screen adds, and the payment depends on both. The amount is
 * stated in the account's own currency, from the same live rate the exchange
 * rate page reads, because a payer typing a dollar figure into a euro transfer
 * sends the wrong money. The reference is what connects the deposit to this
 * request: without it the money still credits the requester, but the request
 * stays open.
 */
export function RequestBankInstructions({
    instructions,
    usdAmount,
}: {
    instructions: RequestDepositInstructions
    /** what the request asks for, in dollars */
    usdAmount?: string
}) {
    const t = useTranslations('payment')
    const format = useFormatter()
    const { t: tDeposit, rowLabels, railLabels, arrivalDetail } = useDepositAccountCopy()
    const account = instructions.depositAccount
    const currency = account.currency.toUpperCase()
    const sameCurrency = currency === 'USD'

    const { exchangeRate } = useExchangeRate({
        sourceCurrency: 'USD',
        destinationCurrency: currency,
        enabled: !sameCurrency,
    })

    const rows = account.instructions ? instructionRows(account.instructions, rowLabels, railLabels) : []
    const corridor = corridorFromRailId(account.railId)
    const toSend = payerAmount(usdAmount, currency, exchangeRate)
    const digits = minorUnitDigits(currency)
    const senderNoteKey = SENDER_NOTE_KEY[account.matching.sender]

    return (
        <div className="flex flex-col gap-4">
            {senderNoteKey && (
                <Notification priority="attention">{t(senderNoteKey as Parameters<typeof t>[0])}</Notification>
            )}

            <Section title={tDeposit('details.sectionTitle')}>
                <DepositDetailsCard rows={rows} />
            </Section>

            {toSend !== undefined && (
                <div className="flex flex-col gap-2">
                    <Card position="single" className="px-4 py-0">
                        <DataRow
                            label={t('bankTransfer.amountLabel')}
                            // Cross-currency amounts come from the client's indicative rate,
                            // and no exact local amount is locked, so they are shown as an
                            // estimate and never as a copyable exact figure. Only a
                            // same-currency (USD) amount is exact and copyable.
                            value={t(sameCurrency ? 'bankTransfer.amountValue' : 'bankTransfer.amountValueApprox', {
                                amount: format.number(toSend, {
                                    minimumFractionDigits: digits,
                                    maximumFractionDigits: digits,
                                }),
                                currency,
                            })}
                            allowCopy={sameCurrency}
                            copyValue={sameCurrency ? toSend.toFixed(digits) : undefined}
                        />
                    </Card>
                    <p className="text-body-s text-foreground-secondary">
                        {sameCurrency ? t('bankTransfer.amountNoteSameCurrency') : t('bankTransfer.amountNote')}
                    </p>
                </div>
            )}

            <Section title={t('bankTransfer.referenceSection')}>
                <Card position="single" className="px-4 py-0">
                    <DataRow
                        label={t('bankTransfer.referenceLabel')}
                        value={instructions.paymentReference}
                        allowCopy={true}
                    />
                </Card>
                <Notification priority="attention">{t('bankTransfer.referenceNote')}</Notification>
            </Section>

            {corridor && <p className="text-body-s text-foreground-secondary">{arrivalDetail(corridor)}</p>}
        </div>
    )
}

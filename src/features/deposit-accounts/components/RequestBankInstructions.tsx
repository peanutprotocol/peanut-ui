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

/** The per-rail amount as the requests-multicurrency API states it. */
type ServerPayerAmount = { value: number; currency: string; isEstimate: boolean }

/**
 * The amount the backend already computed for this rail, when it sent one.
 *
 * Read defensively: `payerAmount` is not in the deposit-instructions contract
 * yet, so this stays optional and returns `undefined` for any shape it does not
 * recognise, and the screen converts on the client instead. Once the API ships
 * the field, this consumes it with no further change here.
 */
function readServerPayerAmount(instructions: RequestDepositInstructions): ServerPayerAmount | undefined {
    const raw = (instructions as { payerAmount?: unknown }).payerAmount
    if (!raw || typeof raw !== 'object') return undefined
    const { amount, currency, isEstimate } = raw as { amount?: unknown; currency?: unknown; isEstimate?: unknown }
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return undefined
    if (typeof currency !== 'string' || currency.length === 0) return undefined
    return { value, currency: currency.toUpperCase(), isEstimate: isEstimate === true }
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
    const accountCurrency = account.currency.toUpperCase()

    // Prefer a per-rail amount the backend computed, when the
    // requests-multicurrency API sends one: it knows the rate it used and
    // whether that figure is an estimate, so it is more trustworthy than a
    // client-side conversion. The field is optional, so this UI and that API
    // ship independently — with no server amount we convert on the client
    // exactly as before, and only then do we need the live rate.
    const serverAmount = readServerPayerAmount(instructions)
    const needsClientRate = !serverAmount && accountCurrency !== 'USD'

    const { exchangeRate } = useExchangeRate({
        sourceCurrency: 'USD',
        destinationCurrency: accountCurrency,
        enabled: needsClientRate,
    })

    const rows = account.instructions ? instructionRows(account.instructions, rowLabels, railLabels) : []
    const corridor = corridorFromRailId(account.railId)
    const clientAmount = payerAmount(usdAmount, accountCurrency, exchangeRate)

    // The one amount the screen shows, whichever source produced it. `estimate`
    // drives both the "≈" prefix and whether the figure is copyable: an
    // estimate is never copyable, because no exact local amount is locked. A
    // client-side cross-currency conversion is always an estimate; a
    // server-locked amount is an estimate only when the backend says so, so a
    // locked non-USD amount can be exact and copyable.
    const amount: { value: number; currency: string; estimate: boolean } | undefined = serverAmount
        ? { value: serverAmount.value, currency: serverAmount.currency, estimate: serverAmount.isEstimate }
        : clientAmount !== undefined
          ? { value: clientAmount, currency: accountCurrency, estimate: accountCurrency !== 'USD' }
          : undefined

    const digits = amount ? minorUnitDigits(amount.currency) : 2
    const senderNoteKey = SENDER_NOTE_KEY[account.matching.sender]

    return (
        <div className="flex flex-col gap-4">
            {senderNoteKey && (
                <Notification priority="attention">{t(senderNoteKey as Parameters<typeof t>[0])}</Notification>
            )}

            <Section title={tDeposit('details.sectionTitle')}>
                <DepositDetailsCard rows={rows} />
            </Section>

            {amount !== undefined && (
                <div className="flex flex-col gap-2">
                    <Card position="single" className="px-4 py-0">
                        <DataRow
                            label={t('bankTransfer.amountLabel')}
                            // An estimate is shown with a "≈" prefix and is never
                            // copyable, because no exact local amount is locked. An
                            // exact amount (same-currency, or a server-locked figure)
                            // is copyable.
                            value={t(amount.estimate ? 'bankTransfer.amountValueApprox' : 'bankTransfer.amountValue', {
                                amount: format.number(amount.value, {
                                    minimumFractionDigits: digits,
                                    maximumFractionDigits: digits,
                                }),
                                currency: amount.currency,
                            })}
                            allowCopy={!amount.estimate}
                            copyValue={amount.estimate ? undefined : amount.value.toFixed(digits)}
                        />
                    </Card>
                    <p className="text-body-s text-foreground-secondary">
                        {amount.estimate ? t('bankTransfer.amountNote') : t('bankTransfer.amountNoteSameCurrency')}
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

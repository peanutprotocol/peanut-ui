'use client'

import { type ReactNode, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { longestLabel, useSentenceFit } from '@/components/Setup/redesign/Residence/useSentenceFit'
import type { SetupFundingChannel, SetupPaymentChannel } from '@/features/setup/paymentChannels'
import { twMerge } from '@/utils/tw'
import { ChannelPill } from './ChannelPill'
import { FUNDING_PILL_KEY, FUNDING_SHEET_KEY, PAYMENT_PILL_KEY, PAYMENT_SHEET_KEY } from './channelLabels'

/**
 * The 08 sentence in the white panel: "You'll first add money with [funding] / then spend with [payment]", the two
 * clauses 16 px apart (8 px on a small phone). Each lead word ("with", "con") shares its line with its pill, and that
 * line holds nothing else, so the lines stay the same in every state (mock freezeLines). The lead lines are balanced, so
 * no lone word sits above a pill line (es-AR 320 "Primero vas a / agregar dinero"). Under it the screen's helper line
 * ("You can change this later.", addendum 2). The fit measures the sentence and that line together, so the pair never
 * runs under the CTA.
 */
export function PlanSentence({
    funding,
    payment,
    fundingOptions,
    paymentOptions,
    bankCurrencies,
    loading,
    qrAbroad,
    helper,
    onFunding,
    onPayment,
}: {
    funding: SetupFundingChannel | null
    payment: SetupPaymentChannel | null
    fundingOptions: readonly SetupFundingChannel[]
    paymentOptions: readonly SetupPaymentChannel[]
    /** The server's bank currencies for the residence; empty when unknown. */
    bankCurrencies: readonly string[]
    loading: boolean
    /** QR payments work only in Argentina and Brazil: residents elsewhere see that in the spending row. */
    qrAbroad: boolean
    helper: ReactNode
    onFunding: (channel: SetupFundingChannel) => void
    onPayment: (channel: SetupPaymentChannel) => void
}) {
    const t = useTranslations('setupRedesign.plan')
    const blockRef = useRef<HTMLDivElement>(null)
    const fundingPillLabels = Object.values(FUNDING_PILL_KEY).map((key) => t(key))
    const paymentPillLabels = (['card', 'qr', 'peanut'] as const).map((channel) => t(PAYMENT_PILL_KEY[channel]))
    const sentenceClass = useSentenceFit(blockRef, {
        worst: { funding: longestLabel(fundingPillLabels), payment: longestLabel(paymentPillLabels) },
    })
    const fundingLabel = (channel: SetupFundingChannel) =>
        channel === 'bank' && bankCurrencies.length
            ? t('fundBankCurrencies', { currencies: bankCurrencies.join(', ') })
            : t(FUNDING_SHEET_KEY[channel])
    return (
        <div ref={blockRef} data-setup-screen="payment-plan">
            <p className={twMerge('[text-wrap:balance] text-foreground-primary', sentenceClass)}>
                {t.rich('sentence', {
                    // a line of its own: a pill that hugs a shorter label never pulls its lead word up onto the line before
                    nw: (chunks) => (
                        <span className="flex w-fit max-w-full items-center whitespace-nowrap" data-fit-group>
                            {chunks}
                        </span>
                    ),
                    gap: () => <span aria-hidden="true" className="block h-4 signup-sm:h-2" />,
                    funding: () => (
                        <ChannelPill<SetupFundingChannel>
                            kind="funding"
                            title={t('sheetFunding')}
                            value={funding}
                            options={fundingOptions}
                            label={fundingLabel}
                            pillLabel={(channel) => t(FUNDING_PILL_KEY[channel])}
                            placeholder={t('choose')}
                            loading={loading}
                            onChange={onFunding}
                        />
                    ),
                    payment: () => (
                        <ChannelPill<SetupPaymentChannel>
                            kind="payment"
                            title={t('sheetPayment')}
                            value={payment}
                            options={paymentOptions}
                            label={(channel) =>
                                channel === 'qr' && qrAbroad ? t('payQrAbroad') : t(PAYMENT_SHEET_KEY[channel])
                            }
                            pillLabel={(channel) => t(PAYMENT_PILL_KEY[channel])}
                            placeholder={t('choose')}
                            loading={loading}
                            onChange={onPayment}
                        />
                    ),
                })}
            </p>
            {helper}
        </div>
    )
}

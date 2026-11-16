'use client'

import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { longestLabel, useSentenceFit } from '@/components/Setup/redesign/Residence/useSentenceFit'
import type { SetupFundingChannel, SetupPaymentChannel } from '@/features/setup/paymentChannels'
import { twMerge } from '@/utils/tw'
import { ChannelPill } from './ChannelPill'
import { FUNDING_PILL_KEY, FUNDING_SHEET_KEY, PAYMENT_PILL_KEY, PAYMENT_SHEET_KEY } from './channelLabels'

/**
 * The 08 sentence in the white panel: "You'll first add money with [funding] / then spend with [payment]", the two
 * clauses 16 px apart (8 px on a small phone). Each lead word ("with", "con") shares its line with its pill. No hint
 * line.
 */
export function PlanSentence({
    funding,
    payment,
    fundingOptions,
    paymentOptions,
    bankCurrencies,
    loading,
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
    onFunding: (channel: SetupFundingChannel) => void
    onPayment: (channel: SetupPaymentChannel) => void
}) {
    const t = useTranslations('setupRedesign.plan')
    const blockRef = useRef<HTMLParagraphElement>(null)
    const fundingSizers = Object.values(FUNDING_PILL_KEY).map((key) => t(key))
    const paymentSizers = (['card', 'qr', 'peanut'] as const).map((channel) => t(PAYMENT_PILL_KEY[channel]))
    const sentenceClass = useSentenceFit(blockRef, {
        worst: { funding: longestLabel(fundingSizers), payment: longestLabel(paymentSizers) },
    })
    const fundingLabel = (channel: SetupFundingChannel) =>
        channel === 'bank' && bankCurrencies.length
            ? t('fundBankCurrencies', { currencies: bankCurrencies.join(', ') })
            : t(FUNDING_SHEET_KEY[channel])
    return (
        <p
            ref={blockRef}
            className={twMerge('[text-wrap:pretty] text-foreground-primary', sentenceClass)}
            data-setup-screen="payment-plan"
        >
            {t.rich('sentence', {
                nw: (chunks) => (
                    <span className="inline-flex max-w-full items-center align-middle whitespace-nowrap" data-fit-group>
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
                        sizers={fundingSizers}
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
                        sizers={paymentSizers}
                        label={(channel) => t(PAYMENT_SHEET_KEY[channel])}
                        pillLabel={(channel) => t(PAYMENT_PILL_KEY[channel])}
                        placeholder={t('choose')}
                        loading={loading}
                        onChange={onPayment}
                    />
                ),
            })}
        </p>
    )
}

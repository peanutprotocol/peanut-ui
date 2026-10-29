'use client'

import { useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { DrawerSelect } from '@/components/0_Bruddle/DrawerSelect'
import { Icon } from '@/components/Global/Icons/Icon'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import {
    setupChannelsForResidence,
    SETUP_CHANNEL_CONCEPTS,
    type SetupChannel,
    type SetupFundingChannel,
    type SetupPaymentChannel,
} from '@/features/setup/paymentChannels'
import { useResidenceRestrictionSetsWithStatus } from '@/hooks/useResidenceRestrictionSets'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import SetupFooter from '../components/SetupFooter'

function ChannelIcon({ channel }: { channel: SetupChannel | null }) {
    // Nothing chosen yet: an empty gray bubble (design.md: gray = nothing selected).
    if (!channel) return <IconBubble icon={<span />} size="xs" color="gray" />
    const concept = SETUP_CHANNEL_CONCEPTS[channel]
    return (
        <IconBubble
            {...CONCEPT_ICONS[concept]}
            size="xs"
            color={concept === 'bank' ? 'green' : CONCEPT_ICONS[concept].color}
        />
    )
}

function ChannelPicker<C extends SetupChannel>({
    kind,
    title,
    value,
    options,
    label,
    compactLabel = label,
    placeholder,
    onChange,
}: {
    kind: 'funding' | 'payment'
    title: string
    value: C | null
    options: readonly C[]
    label: (channel: C) => string
    compactLabel?: (channel: C) => string
    placeholder: string
    onChange: (channel: C) => void
}) {
    const shown = value ? compactLabel(value) : placeholder
    return (
        <DrawerSelect<C>
            title={title}
            value={value}
            onChange={onChange}
            options={options.map((channel) => ({
                value: channel,
                label: label(channel),
                leading: <ChannelIcon channel={channel} />,
            }))}
            trigger={
                <Button
                    variant="secondary"
                    size="compact"
                    shadowSize="2"
                    aria-label={`${title}: ${value ? label(value) : placeholder}`}
                    aria-haspopup="dialog"
                    data-testid={`setup-${kind}-channel`}
                    className="inline-flex w-fit max-w-[calc(100vw_-_8.5rem)] min-w-0 align-middle"
                    icon={<ChannelIcon channel={value} />}
                    iconContainerClassName="size-6"
                >
                    <span className="relative grid min-w-0 overflow-hidden text-left" title={shown}>
                        {/* All labels share one grid cell: the longest translated label
                            sizes the picker, so choosing never changes its width. */}
                        {[placeholder, ...options.map(compactLabel)].map((text) => (
                            <span
                                key={text}
                                aria-hidden="true"
                                className="invisible whitespace-nowrap [grid-area:1/1] compact:hidden"
                            >
                                {text}
                            </span>
                        ))}
                        <span className="block truncate [grid-area:1/1]">{shown}</span>
                    </span>
                    <Icon name="chevron-down" size={20} className="shrink-0" />
                </Button>
            }
        />
    )
}

/**
 * How the user plans to add money and spend it. Both pickers start empty and
 * Continue waits for both choices; the options follow the declared residence.
 */
export default function PaymentPlanStep() {
    const t = useTranslations('setup.paymentPlan')
    const { residenceCountry, fundingChannel, setFundingChannel, paymentChannel, setPaymentChannel } =
        useSetupFlowContext()
    const { handleNext, isLoading } = useSetupFlow()
    const { sets, settled } = useResidenceRestrictionSetsWithStatus()
    const options = useMemo(
        () => setupChannelsForResidence(sets, residenceCountry, settled),
        [sets, residenceCountry, settled]
    )
    const funding = fundingChannel && options.funding.includes(fundingChannel) ? fundingChannel : null
    const payment = paymentChannel && options.payment.includes(paymentChannel) ? paymentChannel : null

    // A changed residence can remove a choice the user made on an earlier visit.
    useEffect(() => {
        if (!settled || !residenceCountry.trim()) return
        if (fundingChannel && !options.funding.includes(fundingChannel)) setFundingChannel(null)
        if (paymentChannel && !options.payment.includes(paymentChannel)) setPaymentChannel(null)
    }, [settled, residenceCountry, fundingChannel, setFundingChannel, paymentChannel, setPaymentChannel, options])

    const onContinue = () => {
        if (!funding || !payment) return
        if (sets.full.has(residenceCountry)) {
            posthog.capture(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_CONTINUED, {
                residence_country: residenceCountry,
            })
        }
        void handleNext()
    }

    return (
        <div className="flex w-full flex-1 flex-col gap-8 compact:gap-4">
            {/* Compact screens take the board's compact plan: one size down, pickers sized to their label. */}
            <h1 className="text-heading-m leading-[2.75rem] compact:text-heading-s compact:leading-[2.5rem] tight:leading-[2.25rem]">
                {t('fundingLead')}{' '}
                <span className="inline-block max-w-full whitespace-nowrap">
                    {t('with')}{' '}
                    <ChannelPicker<SetupFundingChannel>
                        kind="funding"
                        title={t('fundingTitle')}
                        options={options.funding}
                        value={funding}
                        placeholder={t('choose')}
                        compactLabel={(channel) =>
                            t(`funding.${channel === 'brlBank' || channel === 'arsBank' ? 'bank' : channel}`)
                        }
                        label={(channel) =>
                            channel === 'bank' &&
                            options.funding.some((option) => option === 'brlBank' || option === 'arsBank')
                                ? t('funding.bankCurrencies')
                                : t(`funding.${channel}`)
                        }
                        onChange={setFundingChannel}
                    />
                </span>
                <span aria-hidden="true" className="block h-4 compact:h-2" />
                {t('spendLead')}{' '}
                <span className="inline-block max-w-full whitespace-nowrap">
                    {t('with')}{' '}
                    <ChannelPicker<SetupPaymentChannel>
                        kind="payment"
                        title={t('paymentTitle')}
                        options={options.payment}
                        value={payment}
                        placeholder={t('choose')}
                        label={(channel) => t(`payment.${channel}`)}
                        onChange={setPaymentChannel}
                    />
                </span>
            </h1>
            <p className="flex items-start gap-2 text-body-s leading-5 text-foreground-secondary">
                <Icon name="info" size={16} className="mt-0.5 shrink-0" />
                {t('hint')}
            </p>
            <SetupFooter
                actions={
                    <Button
                        shadowSize="4"
                        className="w-full"
                        onClick={onContinue}
                        disabled={!funding || !payment || isLoading}
                        loading={isLoading}
                    >
                        {t('continue')}
                    </Button>
                }
            />
        </div>
    )
}

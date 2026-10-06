'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/Global/Drawer'
import { Icon } from '@/components/Global/Icons/Icon'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import {
    setupChannelsForResidence,
    SETUP_CHANNEL_CONCEPTS,
    type SetupChannel,
    type SetupFundingChannel,
    type SetupPaymentChannel,
} from '@/features/setup/paymentChannels'
import { useResidenceRestrictionSetsWithStatus } from '@/hooks/useResidenceRestrictionSets'
import SetupFooter from '../components/SetupFooter'

function ChannelPicker<C extends SetupChannel>({
    kind,
    title,
    value,
    options,
    label,
    onChange,
}: {
    kind: 'funding' | 'payment'
    title: string
    value: C
    options: readonly C[]
    label: (channel: C) => string
    onChange: (channel: C) => void
}) {
    const [open, setOpen] = useState(false)
    const icon = (channel: SetupChannel) => (
        <IconBubble
            {...CONCEPT_ICONS[
                kind === 'funding' && (channel === 'pix' || channel === 'arQr')
                    ? 'bank'
                    : SETUP_CHANNEL_CONCEPTS[channel]
            ]}
            size="s"
        />
    )
    return (
        <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
            <DrawerTrigger asChild>
                <Button
                    aria-label={`${title}: ${label(value)}`}
                    aria-haspopup="dialog"
                    className="h-auto min-h-12 w-fit max-w-full py-2"
                    icon={icon(value)}
                    iconContainerClassName="size-8"
                >
                    <span className="min-w-0 text-left whitespace-normal">{label(value)}</span>
                    <Icon name="chevron-down" size={24} className="shrink-0" />
                </Button>
            </DrawerTrigger>
            <DrawerContent>
                <div className="flex flex-col gap-4 pb-4">
                    <DrawerTitle>{title}</DrawerTitle>
                    <ListGroup>
                        {options.map((channel) => (
                            <ListItem
                                key={channel}
                                title={
                                    <span
                                        className={channel === value ? 'text-foreground-over-color-primary' : undefined}
                                    >
                                        {label(channel)}
                                    </span>
                                }
                                leading={icon(channel)}
                                trailing={channel === value ? <Icon name="check" size={20} /> : undefined}
                                aria-label={label(channel)}
                                className={
                                    channel === value
                                        ? 'bg-action-primary text-foreground-over-color-primary'
                                        : undefined
                                }
                                onClick={() => {
                                    onChange(channel)
                                    setOpen(false)
                                }}
                            />
                        ))}
                    </ListGroup>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default function PaymentPlan({
    onContinue,
    children,
    loading = false,
}: {
    onContinue: () => void
    children?: ReactNode
    loading?: boolean
}) {
    const t = useTranslations('setup.paymentPlan')
    const tSetup = useTranslations('setup')
    const { residenceCountry, fundingChannel, setFundingChannel, paymentChannel, setPaymentChannel } =
        useSetupFlowContext()
    const { sets, settled } = useResidenceRestrictionSetsWithStatus()
    const options = setupChannelsForResidence(sets, residenceCountry, settled)
    const funding = fundingChannel && options.funding.includes(fundingChannel) ? fundingChannel : options.funding[0]
    const payment = paymentChannel && options.payment.includes(paymentChannel) ? paymentChannel : options.payment[0]
    useEffect(() => {
        if (!settled || !residenceCountry.trim()) return
        if (funding !== fundingChannel) setFundingChannel(funding)
        if (payment !== paymentChannel) setPaymentChannel(payment)
    }, [
        settled,
        residenceCountry,
        funding,
        fundingChannel,
        setFundingChannel,
        payment,
        paymentChannel,
        setPaymentChannel,
    ])

    return (
        <div className="flex w-full flex-1 flex-col gap-8">
            <h1 className="flex flex-col items-start gap-6 text-heading-m">
                <span>{t('addMoney')}</span>
                <ChannelPicker<SetupFundingChannel>
                    kind="funding"
                    title={t('fundingTitle')}
                    options={options.funding}
                    value={funding}
                    label={(channel) => t(`funding.${channel}`)}
                    onChange={setFundingChannel}
                />
                <span>{t('firstPayment')}</span>
                <ChannelPicker<SetupPaymentChannel>
                    kind="payment"
                    title={t('paymentTitle')}
                    options={options.payment}
                    value={payment}
                    label={(channel) => t(`payment.${channel}`)}
                    onChange={setPaymentChannel}
                />
            </h1>
            <p className="flex items-start gap-2 text-body-m leading-[1.625rem] text-foreground-secondary">
                <Icon name="info" size={20} className="mt-1 shrink-0" />
                {t('hint')}
            </p>
            <SetupFooter
                actions={
                    <Button onClick={onContinue} disabled={loading} loading={loading}>
                        {tSetup('cta.features')}
                    </Button>
                }
            >
                {children}
            </SetupFooter>
        </div>
    )
}

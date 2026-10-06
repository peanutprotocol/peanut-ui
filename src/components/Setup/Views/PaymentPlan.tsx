'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
import { deriveResidenceRestrictionsFrom } from '@/hooks/useResidenceRestrictions'

function ChannelPicker<C extends SetupChannel>({
    kind,
    title,
    value,
    placeholder,
    options,
    label,
    onChange,
}: {
    kind: 'funding' | 'payment'
    title: string
    value: C | undefined
    placeholder: string
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
            size="xs"
        />
    )
    return (
        <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
            <DrawerTrigger asChild>
                <Button
                    variant="secondary"
                    size="compact"
                    shadowSize="2"
                    aria-label={`${title}: ${value ? label(value) : placeholder}`}
                    aria-haspopup="dialog"
                    data-testid={`setup-${kind}-channel`}
                    className="inline-flex w-fit max-w-[calc(100vw_-_8.5rem)] min-w-0 align-middle"
                    icon={value ? icon(value) : undefined}
                    iconContainerClassName="size-6"
                >
                    <span className="min-w-0 truncate text-left" title={value ? label(value) : placeholder}>
                        {value ? label(value) : placeholder}
                    </span>
                    <Icon name="chevron-down" size={20} className="shrink-0" />
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
                                    <span className={channel === value ? 'text-foreground-primary' : undefined}>
                                        {label(channel)}
                                    </span>
                                }
                                leading={icon(channel)}
                                trailing={channel === value ? <Icon name="check" size={20} /> : undefined}
                                aria-label={label(channel)}
                                className={
                                    channel === value ? 'bg-background-selection text-foreground-primary' : undefined
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
    selectionRequired = true,
}: {
    onContinue: () => void
    children?: ReactNode
    loading?: boolean
    selectionRequired?: boolean
}) {
    const t = useTranslations('setup.paymentPlan')
    const tSetup = useTranslations('setup')
    const { residenceCountry, fundingChannel, setFundingChannel, paymentChannel, setPaymentChannel } =
        useSetupFlowContext()
    const { sets, settled } = useResidenceRestrictionSetsWithStatus()
    const options = useMemo(
        () => setupChannelsForResidence(sets, residenceCountry, settled),
        [sets, residenceCountry, settled]
    )
    const funding =
        fundingChannel && options.funding.includes(fundingChannel)
            ? fundingChannel
            : selectionRequired
              ? undefined
              : options.funding[0]
    const payment =
        paymentChannel && options.payment.includes(paymentChannel)
            ? paymentChannel
            : selectionRequired
              ? undefined
              : (options.payment.find((channel) => channel !== 'crypto') ?? 'peanut')
    const restrictions = deriveResidenceRestrictionsFrom(sets, residenceCountry.trim().toUpperCase())
    const unavailable =
        restrictions.banking && restrictions.card
            ? 'both'
            : restrictions.banking
              ? 'banking'
              : restrictions.card
                ? 'card'
                : null
    useEffect(() => {
        if (!settled || !residenceCountry.trim()) return
        if (selectionRequired) {
            if (fundingChannel && !options.funding.includes(fundingChannel)) setFundingChannel(null)
            if (paymentChannel && !options.payment.includes(paymentChannel)) setPaymentChannel(null)
            return
        }
        if (funding && funding !== fundingChannel) setFundingChannel(funding)
        if (payment && payment !== paymentChannel) setPaymentChannel(payment)
    }, [
        settled,
        selectionRequired,
        residenceCountry,
        funding,
        fundingChannel,
        setFundingChannel,
        payment,
        paymentChannel,
        setPaymentChannel,
        options.funding,
        options.payment,
    ])

    return (
        <div className="flex w-full flex-1 flex-col gap-8">
            <h1 className="text-heading-m leading-[2.75rem]">
                {t('addMoney')}{' '}
                <span className="inline-block max-w-full whitespace-nowrap">
                    {t('with')}{' '}
                    <ChannelPicker<SetupFundingChannel>
                        kind="funding"
                        title={t('fundingTitle')}
                        options={options.funding}
                        value={funding}
                        placeholder={t('chooseMethod')}
                        label={(channel) => t(`funding.${channel}`)}
                        onChange={setFundingChannel}
                    />
                </span>{' '}
                {t('firstPayment')}{' '}
                <span className="inline-block max-w-full whitespace-nowrap">
                    {t('with')}{' '}
                    <ChannelPicker<SetupPaymentChannel>
                        kind="payment"
                        title={t('paymentTitle')}
                        options={options.payment}
                        value={payment}
                        placeholder={t('chooseMethod')}
                        label={(channel) => t(`payment.${channel}`)}
                        onChange={setPaymentChannel}
                    />
                </span>
            </h1>
            {unavailable && (
                <p role="note" className="text-body-s text-foreground-secondary">
                    {t(`unavailable.${unavailable}`)}
                </p>
            )}
            <p className="flex items-start gap-2 text-body-s leading-5 text-foreground-secondary">
                <Icon name="info" size={16} className="mt-0.5 shrink-0" />
                {t('hint')}
            </p>
            <SetupFooter
                actions={
                    <Button
                        onClick={() => {
                            if (!funding || !payment) return
                            setFundingChannel(funding)
                            setPaymentChannel(payment)
                            onContinue()
                        }}
                        disabled={loading || (selectionRequired && (!funding || !payment))}
                        loading={loading}
                    >
                        {tSetup('cta.features')}
                    </Button>
                }
            >
                {children}
            </SetupFooter>
        </div>
    )
}

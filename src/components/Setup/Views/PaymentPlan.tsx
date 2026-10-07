'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
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
    options,
    label,
    onChange,
    onInteract,
    animate,
    previewValue,
}: {
    kind: 'funding' | 'payment'
    title: string
    value: C
    options: readonly C[]
    label: (channel: C) => string
    onChange: (channel: C) => void
    onInteract: () => void
    animate: boolean
    previewValue?: C
}) {
    const [open, setOpen] = useState(false)
    const icon = (channel: SetupChannel) => {
        const concept = SETUP_CHANNEL_CONCEPTS[channel]
        return (
            <IconBubble
                {...CONCEPT_ICONS[concept]}
                size="xs"
                color={concept === 'bank' ? 'green' : CONCEPT_ICONS[concept].color}
            />
        )
    }
    return (
        <Drawer
            open={open}
            onOpenChange={(next) => {
                if (next) onInteract()
                setOpen(next)
            }}
            shouldScaleBackground={false}
        >
            <DrawerTrigger asChild>
                <Button
                    variant="secondary"
                    size="compact"
                    shadowSize="2"
                    aria-label={`${title}: ${label(value)}`}
                    aria-haspopup="dialog"
                    data-testid={`setup-${kind}-channel`}
                    onPointerDown={onInteract}
                    onFocus={onInteract}
                    className="inline-flex w-fit max-w-[calc(100vw_-_8.5rem)] min-w-0 align-middle"
                    icon={icon(value)}
                    iconContainerClassName="size-6"
                >
                    <span
                        className="relative grid min-w-0 overflow-hidden text-left"
                        aria-live="off"
                        title={label(value)}
                    >
                        {/* All eligible labels share one grid cell: the longest translated
                            label sizes the selector without measuring or changing widths. */}
                        {options.map((channel) => (
                            <span
                                key={channel}
                                aria-hidden="true"
                                className="invisible whitespace-nowrap [grid-area:1/1]"
                            >
                                {label(channel)}
                            </span>
                        ))}
                        {animate ? (
                            <AnimatePresence initial={false} mode="popLayout">
                                <motion.span
                                    key={previewValue ?? 'initial'}
                                    initial={{ y: '-100%', opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: '100%', opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="block truncate [grid-area:1/1]"
                                >
                                    {label(value)}
                                </motion.span>
                            </AnimatePresence>
                        ) : (
                            <span className="block truncate [grid-area:1/1]">{label(value)}</span>
                        )}
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
    animateSuggestions = true,
}: {
    onContinue: () => void
    children?: ReactNode
    loading?: boolean
    animateSuggestions?: boolean
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
    const reducedMotion = useReducedMotion()
    const [interacted, setInteracted] = useState(!!fundingChannel || !!paymentChannel)
    const stopped = useRef(interacted)
    const [preview, setPreview] = useState<{ funding?: SetupFundingChannel; payment?: SetupPaymentChannel }>({})
    const cycle = animateSuggestions && !interacted && !reducedMotion && !loading
    const funding =
        fundingChannel && options.funding.includes(fundingChannel)
            ? fundingChannel
            : preview.funding && options.funding.includes(preview.funding)
              ? preview.funding
              : options.funding[0]
    const payment =
        paymentChannel && options.payment.includes(paymentChannel)
            ? paymentChannel
            : preview.payment && options.payment.includes(preview.payment)
              ? preview.payment
              : (options.payment.find((channel) => channel !== 'crypto') ?? 'peanut')
    const freeze = () => {
        stopped.current = true
        setInteracted(true)
        if (funding) setFundingChannel(funding)
        if (payment) setPaymentChannel(payment)
    }
    useEffect(() => {
        if (!cycle) return
        let top = true
        const advance = () => {
            if (stopped.current || document.visibilityState === 'hidden') return
            const fundingTurn = top
            top = !top
            setPreview((current) => {
                if (fundingTurn) {
                    const index = options.funding.indexOf(current.funding ?? options.funding[0])
                    return { ...current, funding: options.funding[(index + 1) % options.funding.length] }
                }
                // Start with a non-Crypto default, then preview every eligible option.
                const payments = options.payment
                const initialPayment = payments.find((channel) => channel !== 'crypto') ?? 'peanut'
                const index = payments.indexOf(current.payment ?? initialPayment)
                return { ...current, payment: payments[(index + 1) % payments.length] }
            })
        }
        let interval: ReturnType<typeof setInterval> | undefined
        const start = setTimeout(() => {
            advance()
            interval = setInterval(advance, 2000)
        }, 3500)
        return () => {
            clearTimeout(start)
            clearInterval(interval)
        }
    }, [cycle, options.funding, options.payment])
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
        if (fundingChannel && !options.funding.includes(fundingChannel)) setFundingChannel(null)
        if (paymentChannel && !options.payment.includes(paymentChannel)) setPaymentChannel(null)
    }, [settled, residenceCountry, fundingChannel, setFundingChannel, paymentChannel, setPaymentChannel, options])

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
                        label={(channel) => t(`funding.${channel}`)}
                        onChange={setFundingChannel}
                        onInteract={freeze}
                        animate={cycle}
                        previewValue={preview.funding}
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
                        label={(channel) => t(`payment.${channel}`)}
                        onChange={setPaymentChannel}
                        onInteract={freeze}
                        animate={cycle}
                        previewValue={preview.payment}
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
                        disabled={loading}
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

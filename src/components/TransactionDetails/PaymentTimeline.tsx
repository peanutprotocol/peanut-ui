'use client'

import type { ReactNode } from 'react'
import { Check, Circle, Clock3, RotateCcw, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Content, List, Root, Trigger } from '@radix-ui/react-tabs'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import type { TransactionDetails } from './transactionTransformer'
import { buildPaymentTimeline, TERMINAL_PAYMENT_STEPS, type PaymentTimelineStep } from './payment-timeline'
import { useReceiptDateFormatter } from './useReceiptDateFormatter'
import { twMerge } from '@/utils/tw'

export function PaymentTimeline({ steps }: { steps: PaymentTimelineStep[] }) {
    const t = useTranslations('transaction.timeline')
    const formatDate = useReceiptDateFormatter()
    const currentIndex = steps.findLastIndex((step) => !step.state)

    return (
        <ol aria-label={t('title')} aria-live="polite">
            {steps.map(({ step, time, state }, index) => {
                const current = index === currentIndex
                const active = current && !TERMINAL_PAYMENT_STEPS.has(step)
                const failed = step === 'failed' || step === 'undeliverable'
                const cancelled = step === 'cancelled'
                const returned = step === 'refunded' || step === 'returned'
                const Icon = state ? Circle : active ? Clock3 : failed || cancelled ? X : returned ? RotateCcw : Check
                return (
                    <li
                        key={`${step}-${time ?? index}`}
                        className={twMerge('relative', index < steps.length - 1 && 'pb-6')}
                        aria-current={current ? 'step' : undefined}
                        data-state={state ?? (current ? 'current' : 'recorded')}
                    >
                        <div className="ml-10 min-h-4">
                            {time && (
                                <time dateTime={time} className="block text-body-xs text-foreground-secondary">
                                    {formatDate(new Date(time))}
                                </time>
                            )}
                        </div>
                        <div className="relative flex items-center gap-4">
                            {index < steps.length - 1 && (
                                <span
                                    aria-hidden="true"
                                    className="absolute top-6 -bottom-10 left-3 w-px bg-border-subtle"
                                />
                            )}
                            <IconBubble
                                size="xs"
                                color={state || cancelled ? 'gray' : failed ? 'red' : active ? 'yellow' : 'green'}
                                icon={<Icon size={16} className={state ? 'text-foreground-secondary' : undefined} />}
                                className="relative"
                                aria-hidden="true"
                            />
                            <p
                                className={twMerge(
                                    'min-w-0 flex-1',
                                    state
                                        ? 'text-body-m text-foreground-secondary'
                                        : current
                                          ? 'text-body-m-semibold text-foreground-primary'
                                          : 'text-body-m text-foreground-primary'
                                )}
                            >
                                {t(step)}
                            </p>
                        </div>
                        {state && <span className="sr-only">{t(state)}</span>}
                    </li>
                )
            })}
        </ol>
    )
}

/** Receipt-specific design requested 2026-10-07: blue, bordered active tab,
 * flush with a white panel on a beige background. The app-wide DS Tabs appearance stays separate;
 * Radix retains the same keyboard and tab/panel accessibility contract. */
export function PaymentReceiptTabs({
    transaction,
    details,
    isPublic = false,
}: {
    transaction: TransactionDetails
    details: ReactNode
    isPublic?: boolean
}) {
    const t = useTranslations('transaction.timeline')
    const steps = buildPaymentTimeline(transaction)
    if (isPublic || steps.length === 0) return <>{details}</>

    return (
        <Root key={transaction.id} defaultValue="updates" className="isolate w-full bg-background-page">
            <List aria-label={t('information')} className="flex w-full">
                {(['updates', 'details'] as const).map((value) => (
                    <Trigger
                        key={value}
                        value={value}
                        className="relative flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-t-sm border border-transparent px-4 py-2 text-foreground-secondary focus-visible:z-10 focus-visible:outline-[3px] focus-visible:outline-offset-[-3px] focus-visible:outline-action-focus focus-visible:outline-solid data-[state=active]:z-10 data-[state=active]:border-border-default data-[state=active]:bg-background-tab-active data-[state=active]:text-body-m-semibold data-[state=active]:text-foreground-primary data-[state=inactive]:text-body-m"
                    >
                        {t(value)}
                    </Trigger>
                ))}
            </List>
            <Content
                value="updates"
                className="-mt-px rounded-sm border border-border-default bg-background-default p-4 focus-visible:outline-[3px] focus-visible:outline-action-focus focus-visible:outline-solid"
            >
                <PaymentTimeline steps={steps} />
            </Content>
            <Content
                value="details"
                className="-mt-px rounded-sm border border-border-default bg-background-default p-4 focus-visible:outline-[3px] focus-visible:outline-action-focus focus-visible:outline-solid"
            >
                {details}
            </Content>
        </Root>
    )
}

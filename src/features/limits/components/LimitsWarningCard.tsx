'use client'

import InfoCard from '@/components/Global/InfoCard'
import { Icon } from '@/components/Global/Icons/Icon'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useModalsContext } from '@/context/ModalsContext'
import { twMerge } from 'tailwind-merge'
import { LIMITS_COPY, type LimitsWarningItem } from '../utils'

export type LimitsWarningType = 'warning' | 'error'

export interface LimitsWarningCardProps {
    type: LimitsWarningType
    /** English fallback; `titleKind` takes precedence when set */
    title: string
    titleKind?: 'blocking' | 'warning'
    items: LimitsWarningItem[]
    showSupportLink?: boolean
    /** when set, shows an "Increase my limits" button instead of the support link */
    onIncreaseLimits?: () => void
    /** loading state for the increase limits action */
    isIncreaseLimitsLoading?: boolean
    className?: string
}

/**
 * reusable card for displaying limit warnings (yellow) or blocking errors (red)
 * used across qr payments, add money, and withdraw flows
 */
export default function LimitsWarningCard({
    type,
    title,
    titleKind,
    items,
    showSupportLink = true,
    onIncreaseLimits,
    isIncreaseLimitsLoading,
    className,
}: LimitsWarningCardProps) {
    const t = useTranslations('limits')
    const tCommon = useTranslations('common')
    const { openSupportWithMessage } = useModalsContext()

    // getLimitsWarningCardProps can't translate (it's a util), so it tags each
    // item with a `kind` and we resolve the copy here — one place for every flow
    const itemText = (item: LimitsWarningItem): string => {
        switch (item.kind) {
            case 'limit-amount': {
                const amount = item.amount ?? ''
                if (item.flowType === 'onramp') {
                    return item.perTransaction
                        ? t('warningCard.addUpToPerTransaction', { amount })
                        : t('warningCard.addUpTo', { amount })
                }
                if (item.flowType === 'offramp') {
                    return item.perTransaction
                        ? t('warningCard.withdrawUpToPerTransaction', { amount })
                        : t('warningCard.withdrawUpTo', { amount })
                }
                return item.perTransaction
                    ? t('warningCard.payUpToPerTransaction', { amount })
                    : t('warningCard.payUpTo', { amount })
            }
            case 'reset-days':
                return t('warningCard.resetsInDays', { days: item.days ?? 0 })
            case 'check-limits':
                return t('warningCard.checkLimits')
            default:
                return item.text
        }
    }

    return (
        <InfoCard
            variant={type === 'error' ? 'warning' : 'warning'}
            icon="info-filled"
            iconClassName={type === 'error' ? 'text-error' : 'text-yellow-9'}
            title={titleKind ? t(`warningCard.${titleKind}Title`) : title}
            titleClassName="font-semibold"
            className={twMerge('p-4', className)}
            customContent={
                <div className="flex flex-col gap-2">
                    <ul className="list-inside list-disc space-y-1 text-xs md:text-sm">
                        {items.map((item, index) => (
                            <li key={index}>
                                {item.isLink && item.href ? (
                                    <Link href={item.href} className="underline underline-offset-2">
                                        {item.icon && (
                                            <Icon name={item.icon} className="mr-1 text-yellow-11" size={12} />
                                        )}
                                        <span className="text-yellow-11">{itemText(item)}</span>
                                    </Link>
                                ) : (
                                    itemText(item)
                                )}
                            </li>
                        ))}
                    </ul>
                    {onIncreaseLimits ? (
                        <>
                            <div className="my-1 border-t border-yellow-9" />
                            <button
                                onClick={onIncreaseLimits}
                                disabled={isIncreaseLimitsLoading}
                                className="flex items-center gap-1 text-xs md:text-sm"
                            >
                                <Icon name="plus-circle" className="text-yellow-11" size={12} />
                                <span className="font-semibold text-yellow-11 underline">
                                    {isIncreaseLimitsLoading ? tCommon('loading') : t('increase.cta')}
                                </span>
                            </button>
                        </>
                    ) : showSupportLink ? (
                        <>
                            <div className="my-1 border-t border-yellow-9" />
                            <button
                                onClick={() => openSupportWithMessage(LIMITS_COPY.SUPPORT_MESSAGE)}
                                className="flex items-center gap-1 text-xs md:text-sm"
                            >
                                <Icon name="plus-circle" className="text-yellow-11" size={12} />
                                <span className="font-semibold text-yellow-11 underline">{t('needHigherLimits')}</span>
                            </button>
                        </>
                    ) : null}
                </div>
            }
        />
    )
}

'use client'

import InfoCard from '@/components/Global/InfoCard'
import { Icon } from '@/components/Global/Icons/Icon'
import Link from 'next/link'
import { useModalsContext } from '@/context/ModalsContext'
import { twMerge } from 'tailwind-merge'
import { LIMITS_COPY, type LimitsWarningItem } from '../utils'

export type LimitsWarningType = 'warning' | 'error'

export interface LimitsWarningCardProps {
    type: LimitsWarningType
    title: string
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
    items,
    showSupportLink = true,
    onIncreaseLimits,
    isIncreaseLimitsLoading,
    className,
}: LimitsWarningCardProps) {
    const { openSupportWithMessage } = useModalsContext()

    return (
        <InfoCard
            variant={type === 'error' ? 'warning' : 'warning'}
            icon="info-filled"
            iconClassName={type === 'error' ? 'text-error' : 'text-yellow-9'}
            title={title}
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
                                        <span className="text-yellow-11">{item.text}</span>
                                    </Link>
                                ) : (
                                    item.text
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
                                    {isIncreaseLimitsLoading ? 'Loading...' : 'Increase my limits'}
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
                                <span className="font-semibold text-yellow-11 underline">
                                    Need higher limits? Contact support.
                                </span>
                            </button>
                        </>
                    ) : null}
                </div>
            }
        />
    )
}

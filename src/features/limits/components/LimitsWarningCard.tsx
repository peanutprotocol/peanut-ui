'use client'

import { Callout } from '@/components/0_Bruddle/Callout'
import { BulletList } from '@/components/0_Bruddle/BulletList'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Icon } from '@/components/Global/Icons/Icon'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useModalsContext } from '@/context/ModalsContext'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { isCapacitor } from '@/utils/capacitor'
import { LIMITS_COPY, type LimitFlowType, type LimitsWarningItem } from '../utils'

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
    /** context included in route diagnostics; especially useful for native ARS/BRL reports */
    flowType?: LimitFlowType
    currency?: string
    className?: string
}

const NAVIGATION_CHECK_DELAY_MS = 1500

function normalizePathname(pathname: string): string {
    const normalized = pathname.replace(/\/+$/, '')
    return normalized || '/'
}

function bodyPointerEvents(): string {
    if (typeof document === 'undefined' || !document.body) return 'unknown'
    const inlineValue = document.body.style.pointerEvents
    if (inlineValue) return inlineValue
    return window.getComputedStyle?.(document.body).pointerEvents || 'unset'
}

function captureNavigation(properties: Record<string, unknown>): void {
    try {
        posthog.capture(ANALYTICS_EVENTS.LIMITS_CHECK_LINK_NAVIGATION, properties)
    } catch {
        // Diagnostics must never make a recovery CTA less reliable.
    }
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
    flowType,
    currency,
    className,
}: LimitsWarningCardProps) {
    const t = useTranslations('limits')
    const tCommon = useTranslations('common')
    const router = useRouter()
    const { openSupportWithMessage } = useModalsContext()
    const [navigationError, setNavigationError] = useState(false)
    const navigationTimer = useRef<number | null>(null)
    const mountedRef = useRef(true)

    useEffect(
        () => () => {
            // Keep the post-navigation check alive so successful route changes are
            // still measured after this card unmounts; the ref prevents a stale
            // failed check from updating an unmounted card.
            mountedRef.current = false
        },
        []
    )

    const handleLimitsNavigation = (href: string) => {
        if (navigationTimer.current !== null) window.clearTimeout(navigationTimer.current)
        setNavigationError(false)

        const pointerEventsBefore = bodyPointerEvents()
        const context = {
            target: href,
            type,
            flow_type: flowType ?? 'unknown',
            currency: currency?.toUpperCase() ?? 'unknown',
            native: isCapacitor(),
        }
        captureNavigation({ ...context, outcome: 'attempted', pointer_events_before: pointerEventsBefore })

        try {
            router.push(href)
        } catch {
            const pointerEventsAfter = bodyPointerEvents()
            captureNavigation({
                ...context,
                outcome: 'failed',
                pointer_events_before: pointerEventsBefore,
                pointer_events_after: pointerEventsAfter,
                pointer_events_changed: pointerEventsBefore !== pointerEventsAfter,
            })
            setNavigationError(true)
            return
        }

        // App Router push is fire-and-forget. If the native WebView swallows it,
        // leave the user on a usable screen with a retry instead of a dead CTA.
        navigationTimer.current = window.setTimeout(() => {
            const pointerEventsAfter = bodyPointerEvents()
            const reachedLimits = normalizePathname(window.location.pathname) === normalizePathname(href)
            captureNavigation({
                ...context,
                outcome: reachedLimits ? 'completed' : 'failed',
                pointer_events_before: pointerEventsBefore,
                pointer_events_after: pointerEventsAfter,
                pointer_events_changed: pointerEventsBefore !== pointerEventsAfter,
            })
            if (!reachedLimits && mountedRef.current) setNavigationError(true)
        }, NAVIGATION_CHECK_DELAY_MS)
    }

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
        <Callout
            priority={type === 'error' ? 'error' : 'attention'}
            hideIcon
            title={titleKind ? t(`warningCard.${titleKind}Title`) : title}
            className={className}
        >
            <div className="flex flex-col gap-2">
                <BulletList
                    items={items.map((item, index) => (
                        <span key={index}>
                            {item.isLink && item.href ? (
                                item.kind === 'check-limits' ? (
                                    <button
                                        type="button"
                                        onClick={() => handleLimitsNavigation(item.href!)}
                                        className="pointer-events-auto underline underline-offset-2"
                                    >
                                        {item.icon && <Icon name={item.icon} className="mr-1" size={16} />}
                                        <span>{itemText(item)}</span>
                                    </button>
                                ) : (
                                    <Link href={item.href} className="underline underline-offset-2">
                                        {item.icon && <Icon name={item.icon} className="mr-1" size={16} />}
                                        <span>{itemText(item)}</span>
                                    </Link>
                                )
                            ) : (
                                itemText(item)
                            )}
                        </span>
                    ))}
                />
                {onIncreaseLimits ? (
                    <>
                        <div className="my-1 border-t" />
                        <button
                            onClick={onIncreaseLimits}
                            disabled={isIncreaseLimitsLoading}
                            className="flex items-center gap-1"
                        >
                            <Icon name="plus-circle" size={16} />
                            <span className="font-semibold underline">
                                {isIncreaseLimitsLoading ? tCommon('loading') : t('increase.cta')}
                            </span>
                        </button>
                    </>
                ) : showSupportLink ? (
                    <>
                        <div className="my-1 border-t" />
                        <button
                            onClick={() => openSupportWithMessage(LIMITS_COPY.SUPPORT_MESSAGE)}
                            className="flex items-center gap-1"
                        >
                            <Icon name="plus-circle" size={16} />
                            <span className="font-semibold underline">{t('needHigherLimits')}</span>
                        </button>
                    </>
                ) : null}
                {navigationError && (
                    /* mt-2 on top of the stack's gap-2 = 16px, clear of the underlined
                       increase/support button above (the link's hit area extends 14px up) */
                    <div className="mt-2 flex items-center justify-between gap-2">
                        <FieldError className="m-0">{tCommon('genericError')}</FieldError>
                        <LinkButton
                            onClick={() => handleLimitsNavigation('/limits')}
                            className="pointer-events-auto shrink-0"
                        >
                            {tCommon('tryAgain')}
                        </LinkButton>
                    </div>
                )}
            </div>
        </Callout>
    )
}

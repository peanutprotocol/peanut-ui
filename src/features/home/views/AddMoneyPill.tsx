'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { useLayoutEffect, useRef, useState } from 'react'
import { balanceBucket } from '../addMoneyPill.utils'

interface AddMoneyPillProps {
    balance: bigint
    /** money came in before: the label reads "Top up" instead of "Add money" */
    hasFundedBefore: boolean
    /** set: Add links straight to the picker; unset: Add opens its drawer */
    href?: string
    isDrawerOpen: boolean
    onTap: () => void
}

/**
 * The home Add action as a DS primary pill, while a verified user's balance is
 * under $10. The pill reaches left into the row padding (-ml-10 matches the
 * row's px-10 in BalanceSection) and stops 16px short of Send's column. When
 * the label does not fit there (e.g. "Add money" at 320px), it falls back to
 * the round button's word ("Add") rather than an ellipsis.
 */
export function AddMoneyPill({ balance, hasFundedBefore, href, isDrawerOpen, onTap }: AddMoneyPillProps) {
    const t = useAppTranslations('home')
    const tNav = useTranslations('navigation')
    const labelRef = useRef<HTMLSpanElement>(null)
    const [isShortLabel, setIsShortLabel] = useState(false)

    useLayoutEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.HOME_ADD_CTA_SHOWN, {
            balance_bucket: balanceBucket(balance),
            label: hasFundedBefore ? 'top_up' : 'add_money',
        })
        // measured before paint, again once web fonts load and on resize; the
        // swap to the short word is one-way for this mount
        const label = labelRef.current
        if (!label) return
        const check = () => {
            if (label.scrollWidth > label.clientWidth) setIsShortLabel(true)
        }
        check()
        let active = true
        document.fonts?.ready.then(() => active && check())
        const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(check)
        observer?.observe(label)
        return () => {
            active = false
            observer?.disconnect()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const shared = {
        variant: 'primary' as const,
        size: 'small' as const,
        icon: 'plus' as const,
        iconContainerClassName: 'size-4',
        className: 'mt-1 -ml-10 inline-flex w-auto max-w-[calc(100%+1.5rem)]',
        'data-testid': 'home-submenu-add',
        onClick: onTap,
        children: (
            <span ref={labelRef} className="truncate">
                {isShortLabel ? tNav('add') : t(hasFundedBefore ? 'addMoneyPill.topUp' : 'addMoneyPill.addMoney')}
            </span>
        ),
    }
    return href ? <Button href={href} {...shared} /> : <Button aria-expanded={isDrawerOpen} {...shared} />
}

'use client'

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import Badge from '@/components/Global/Badges/Badge'
import { useBankRegionRefusal } from '@/features/card/useBankRegionRefusal'
import type { DrawerBankPlan } from './addMoneyDrawerPlan'

export type BankMethodState = {
    /** false when the residence rules bank out: the row sorts last */
    offered: boolean
    /** the plan, or for "not offered" the residence rule, is not known yet */
    unknown: boolean
    /** the user cannot use bank now: the row is disabled and opens nothing */
    blocked: boolean
    badge: ReactNode
}

/**
 * The bank row's state, the same on the card step and in the drawer's choice. The badge names the
 * block. Kush (2026-11-26): a bank the user cannot use now (under review, setting up, or ruled out by
 * the residence) is a disabled row with its badge and no drawer, sorted last when it is not offered.
 * This departs from design.md "rows the user cannot act on" (such a row stays tappable and its tap
 * says why), by his decision. Not verified, and a step left, stay tappable: the user can act on them.
 * Until the plan, and for "not offered" the residence rule, is known, the row waits disabled with no
 * badge: a drawer opened on a guess could not be right.
 */
export function useBankMethodState(plan: DrawerBankPlan): BankMethodState {
    const tAccounts = useTranslations('depositAccounts')
    const region = useBankRegionRefusal()
    const offered = !(plan.kind === 'not-offered' && region.refused)
    const unknown = plan.kind === 'loading' || (plan.kind === 'not-offered' && !region.known)
    const blocked = unknown || !offered || plan.kind === 'under-review' || plan.kind === 'setting-up'
    const badge = unknown ? undefined : !offered ? (
        <Badge status="neutral" customText={tAccounts('list.badgeNotOffered')} />
    ) : plan.kind === 'not-verified' ? (
        <Badge status="pending" customText={tAccounts('list.badgeVerifyId')} />
    ) : plan.kind === 'under-review' ? (
        <Badge status="pending" customText={tAccounts('list.badgeUnderReview')} />
    ) : plan.kind === 'setting-up' ? (
        <Badge status="pending" customText={tAccounts('list.badgeSettingUp')} />
    ) : plan.kind === 'finish-setup' || plan.kind === 'not-offered' ? (
        <Badge status="pending" customText={tAccounts('list.badgeActionNeeded')} />
    ) : undefined
    return { offered, unknown, blocked, badge }
}

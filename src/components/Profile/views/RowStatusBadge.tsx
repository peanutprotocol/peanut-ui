'use client'

import Badge from '@/components/Global/Badges/Badge'
import type { IconBubble } from '@/components/0_Bruddle/IconBubble'
import type { UnlockChip, UnlockRow } from '@/utils/unlock-payments.utils'

/**
 * The one status-badge vocabulary for a KYC-unlock row (bank/QR rows and the
 * always-on Peanut rows) — shared by the bank rows of `AccountsHubList` and the
 * Spend and Peanut groups so all read from the same chip→badge mapping. Virtual
 * accounts carry their own account badges, since an account has no "unlock"
 * state to describe.
 */
// next-intl's per-namespace translator type is narrower than `(key: string) => string`, and this
// helper is shared across namespaced callers, so it accepts any translator rather than one namespace.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowStatusBadge(row: UnlockRow, t: (key: any) => string) {
    switch (row.chip) {
        case 'active':
        case 'alwaysOn':
            return <Badge status="completed" customText={t(`chips.${row.chip}`)} />
        case 'processing':
            return <Badge status="processing" customText={t('chips.processing')} />
        case 'attention':
            return <Badge status="pending" customText={t('chips.attention')} />
        // a DS badge, not a pill of its own: a dead end, or nothing done yet,
        // is a fact with no tone, which is what neutral says (Konrad,
        // 2026-09-23). Every row on the list draws it the same way.
        case 'notAvailable':
            return <Badge status="neutral" customText={t('chips.notAvailable')} />
        case 'unlock':
            return <Badge status="neutral" customText={t('chips.unlock')} />
    }
}

/** During a verification outage the unlock path is closed, so those rows render inert. */
export function isRowTappable(row: UnlockRow, isKycDegraded: boolean): boolean {
    return !!row.href || row.chip === 'active' || row.chip === 'alwaysOn' || (!!row.regionPath && !isKycDegraded)
}

type IconBubbleColor = NonNullable<React.ComponentProps<typeof IconBubble>['color']>

/** IconBubble color per chip — used only by rows that still lead with an icon (the Peanut group). */
export const BUBBLE_COLOR: Record<UnlockChip, IconBubbleColor> = {
    active: 'green',
    alwaysOn: 'green',
    unlock: 'blue',
    processing: 'blue',
    attention: 'yellow',
    notAvailable: 'gray',
}

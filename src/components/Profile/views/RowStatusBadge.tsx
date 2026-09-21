'use client'

import Badge from '@/components/Global/Badges/Badge'
import type { IconBubble } from '@/components/0_Bruddle/IconBubble'
import type { UnlockChip, UnlockRow } from '@/utils/unlock-payments.utils'

/**
 * The one status-badge vocabulary for a KYC-unlock row (bank/QR rows and the
 * always-on Peanut rows) — shared by the merged "Your accounts" list and the
 * "Peanut" group so both read from the same chip→badge mapping. Held VA rows
 * use their own simpler Ready/nothing badge (see `AccountsList`), since a
 * held account has no "unlock" state to describe.
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
        case 'notAvailable':
            if (row.labelKey === 'card') {
                return (
                    <Badge
                        status="custom"
                        customText={t('chips.notAvailable')}
                        className="bg-background-badge-helper"
                    />
                )
            }
            return <span className="text-body-s text-foreground-secondary">{t('chips.notAvailable')}</span>
        case 'unlock':
            return <span className="text-body-s text-foreground-secondary">{t('chips.unlock')}</span>
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

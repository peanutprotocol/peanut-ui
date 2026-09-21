import { ListItem } from '@/components/0_Bruddle/ListItem'
import { CorridorFlag } from '@/features/deposit-accounts/components/CorridorFlag'
import type { UnlockRow } from '@/utils/unlock-payments.utils'
import type { useTranslations } from 'next-intl'
import type { ReactElement } from 'react'
import { isRowTappable, rowStatusBadge } from './RowStatusBadge'

/**
 * One ListItem per KYC-unlock bank/QR corridor.
 *
 * A function that returns the rows, not a component that wraps them: ListGroup
 * gives first/middle/last positions to its DIRECT children, so rows behind a
 * wrapper component each rendered as their own bordered card.
 */
export function bankListItems(
    rows: readonly UnlockRow[],
    onRowClick: (row: UnlockRow) => void,
    isKycDegraded: boolean,
    t: ReturnType<typeof useTranslations<'profile.unlockPayments'>>
): ReactElement[] {
    return rows.map((row) => {
        const tappable = isRowTappable(row, isKycDegraded)
        return (
            <ListItem
                key={row.id}
                className="min-h-18"
                disabled={row.chip === 'notAvailable'}
                leading={row.flag ? <CorridorFlag iso2={row.flag} /> : undefined}
                title={<span className="break-words whitespace-normal">{t(`rows.${row.labelKey}`)}</span>}
                trailing={rowStatusBadge(row, t)}
                chevron={tappable}
                onClick={tappable ? () => onRowClick(row) : undefined}
            />
        )
    })
}

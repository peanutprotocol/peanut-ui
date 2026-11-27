'use client'

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { CorridorFlag } from '@/features/deposit-accounts/components/CorridorFlag'
import { DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import { useDepositAccountCopy } from '@/features/deposit-accounts/useDepositAccountCopy'
import { useDepositAccounts } from '@/features/deposit-accounts/useDepositAccounts'
import type { DrawerBankRow } from './addMoneyDrawerPlan'

/**
 * The bank ways ready now, titled as the Add money picker and options title them. A held account
 * names its own rails, the same name its details title shows.
 */
export function DrawerBankRowsView({
    rows,
    onPick,
    children,
}: {
    rows: DrawerBankRow[]
    onPick: (row: DrawerBankRow) => void
    /** rows after the bank ones in the same group: the drawer's choice adds crypto */
    children?: ReactNode
}) {
    const tMethods = useTranslations('addMoney.methods')
    const { accountRailName } = useDepositAccountCopy()
    // only a held account's row names its rails from its details
    const { accounts } = useDepositAccounts({ enabled: rows.some((row) => row.kind === 'account') })
    return (
        <ListGroup>
            {rows.map((row) => {
                const rail = DEPOSIT_RAILS[row.corridor]
                const pix = row.corridor === 'PIX_BR'
                return (
                    <ListItem
                        key={row.corridor}
                        data-testid={`card-add-money-rail-${row.corridor.toLowerCase()}`}
                        title={pix ? tMethods('pix') : rail.currency}
                        body={
                            row.kind === 'account'
                                ? accountRailName(row.corridor, accounts[row.corridor]?.instructions)
                                : pix
                                  ? tMethods('pixDetails')
                                  : row.corridor === 'BANK_TRANSFER_AR'
                                    ? tMethods('arsDetails')
                                    : tMethods('bankDetails')
                        }
                        bodyWrap
                        leading={
                            pix ? <IconBubble {...CONCEPT_ICONS.pix} size="s" /> : <CorridorFlag iso2={rail.flagIso2} />
                        }
                        chevron
                        onClick={() => onPick(row)}
                    />
                )
            })}
            {children}
        </ListGroup>
    )
}

'use client'

import { useTranslations } from 'next-intl'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import type { CardBankRow } from '@/features/card/cardAddMoney'
import { CorridorFlag } from '@/features/deposit-accounts/components/CorridorFlag'
import { DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import { useDepositAccountCopy } from '@/features/deposit-accounts/useDepositAccountCopy'

/** The bank ways ready now, titled as the Add money picker and options title them. */
export function CardBankRowsView({ rows, onPick }: { rows: CardBankRow[]; onPick: (row: CardBankRow) => void }) {
    const tMethods = useTranslations('addMoney.methods')
    const { railName } = useDepositAccountCopy()
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
                                ? railName(row.corridor)
                                : pix
                                  ? tMethods('pixDetails')
                                  : row.corridor === 'BANK_TRANSFER_AR'
                                    ? tMethods('arsDetails')
                                    : tMethods('oneTimeTransfer')
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
        </ListGroup>
    )
}

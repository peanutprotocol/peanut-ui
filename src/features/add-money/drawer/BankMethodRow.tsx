'use client'

import { useTranslations } from 'next-intl'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import type { BankMethodState } from './useBankMethodState'

/** The "Bank transfer" row, with the badge and disabled state `useBankMethodState` gives it. */
export function BankMethodRow({
    bank,
    onClick,
    testId,
}: {
    bank: BankMethodState
    onClick: () => void
    testId: string
}) {
    const tAdd = useTranslations('addMoney')
    return (
        <ListItem
            title={tAdd('methods.bankTransfer')}
            body={tAdd('methods.bankTransferDescription')}
            bodyWrap
            // the bank concept keeps its blue in every state (design.md icon bubble colour: a call site never
            // overrides a concept's colour); the disabled fill, title colour and badge say the state
            leading={<IconBubble {...CONCEPT_ICONS.bank} size="s" />}
            trailing={bank.badge}
            chevron={!bank.blocked}
            disabled={bank.blocked}
            onClick={onClick}
            data-testid={testId}
        />
    )
}

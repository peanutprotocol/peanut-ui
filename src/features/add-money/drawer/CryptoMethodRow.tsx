'use client'

import { useTranslations } from 'next-intl'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import type { CardPosition } from '@/components/Global/Card/card.utils'

/** The "Crypto" row, the same on the card step and in the drawer's choice. */
export function CryptoMethodRow({
    onClick,
    testId,
    position,
}: {
    onClick: () => void
    testId: string
    /** set by ListGroup: without it the row draws its own full border, a 2px line next to its neighbour */
    position?: CardPosition
}) {
    const tAdd = useTranslations('addMoney')
    return (
        <ListItem
            title={tAdd('methods.crypto')}
            body={tAdd('methods.cryptoDescription')}
            leading={<IconBubble {...CONCEPT_ICONS.crypto} size="s" />}
            chevron
            onClick={onClick}
            position={position}
            data-testid={testId}
        />
    )
}

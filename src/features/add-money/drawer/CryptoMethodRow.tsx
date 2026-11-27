'use client'

import { useTranslations } from 'next-intl'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { ListItem } from '@/components/0_Bruddle/ListItem'

/** The "Crypto" row, the same on the card step and in the drawer's choice. */
export function CryptoMethodRow({ onClick, testId }: { onClick: () => void; testId: string }) {
    const tAdd = useTranslations('addMoney')
    return (
        <ListItem
            title={tAdd('methods.crypto')}
            body={tAdd('methods.cryptoDescription')}
            leading={<IconBubble {...CONCEPT_ICONS.crypto} size="s" />}
            chevron
            onClick={onClick}
            data-testid={testId}
        />
    )
}

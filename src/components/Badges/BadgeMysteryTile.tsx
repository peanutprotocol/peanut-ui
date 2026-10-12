'use client'

import { useTranslations } from 'next-intl'
import { CARD_SURFACE } from '@/components/0_Bruddle/Card'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'

/**
 * Closes the badges grid with a hint that some badges cannot be earned on
 * purpose: OG, event and partner badges appear for special moments (Hugo,
 * 2026-09-25). Not a button, because there is nothing to earn or open. It
 * keeps the gallery tile's box: the art is a square 3/4 of the tile width.
 */
export const BadgeMysteryTile = () => {
    const t = useTranslations('badges.mystery')

    return (
        <div
            className={`relative flex min-w-0 flex-col items-center ${CARD_SURFACE} bg-background-disabled px-2 pt-2 pb-3 text-center`}
        >
            <div className="flex aspect-square w-3/4 items-center justify-center" aria-hidden>
                <IconBubble {...CONCEPT_ICONS.badges} size="l" />
            </div>
            <span className="mt-2 line-clamp-2 h-8 w-full text-label-m">{t('title')}</span>
            <span className="line-clamp-2 h-8 w-full text-body-xs text-foreground-secondary">{t('description')}</span>
        </div>
    )
}

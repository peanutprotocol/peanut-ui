import React from 'react'
import { Card } from '@/components/0_Bruddle/Card'
import { IconBubble, type IconBubbleColor } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS, type Concept } from '@/components/0_Bruddle/conceptIcons'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { type IconName } from '../Icons/Icon'
import { twMerge } from '@/utils/tw'

type EmptyStateProps = (
    | { icon: IconName; iconColor?: IconBubbleColor; concept?: never }
    // a product concept keeps its CONCEPT_ICONS bubble here too
    | { concept: Concept; icon?: never; iconColor?: never }
) & {
    title: string | React.ReactNode
    description?: React.ReactNode
    cta?: React.ReactNode
    containerClassName?: HTMLDivElement['className']
}

/**
 * Informational empty-state card. Thin wrapper over the 0_Bruddle Card per
 * the card board (17788:17569, card.cta.none): centered icon bubble, title,
 * secondary body, optional cta. Zero custom styling of its own.
 */
export default function EmptyState({
    title,
    description,
    icon,
    iconColor = 'gray',
    concept,
    cta,
    containerClassName,
}: EmptyStateProps) {
    const bubble = concept ? CONCEPT_ICONS[concept] : { icon: icon as IconName, color: iconColor }
    return (
        <Card className={twMerge('items-center gap-2 px-4 py-6 text-center', containerClassName)}>
            <IconBubble {...bubble} size="s" />
            <TitleBlock title={title} description={description}>
                {cta}
            </TitleBlock>
        </Card>
    )
}

import React from 'react'
import { Card } from '@/components/0_Bruddle/Card'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { type IconName } from '../Icons/Icon'
import { twMerge } from '@/utils/tw'

interface EmptyStateProps {
    icon: IconName
    title: string | React.ReactNode
    description?: string
    cta?: React.ReactNode
    containerClassName?: HTMLDivElement['className']
}

/**
 * Informational empty-state card. Thin wrapper over the 0_Bruddle Card per
 * the card board (17788:17569, card.cta.none): centered icon bubble, title,
 * secondary body, optional cta. Zero custom styling of its own.
 */
export default function EmptyState({ title, description, icon, cta, containerClassName }: EmptyStateProps) {
    return (
        <Card className={twMerge('items-center gap-2 px-4 py-6 text-center', containerClassName)}>
            <IconBubble icon={icon} size="s" color="gray" />
            <TitleBlock title={title} description={description}>
                {cta}
            </TitleBlock>
        </Card>
    )
}

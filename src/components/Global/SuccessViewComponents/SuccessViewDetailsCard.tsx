import { Card } from '@/components/0_Bruddle/Card'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { useTranslations } from 'next-intl'
import React from 'react'
import Badge, { type StatusType } from '../Badges/Badge'

interface SuccessViewDetailsCardProps {
    title: string
    amountDisplay?: string
    description?: string
    status?: StatusType
}

export const SuccessViewDetailsCard: React.FC<SuccessViewDetailsCardProps> = ({
    title,
    amountDisplay,
    description,
    status = 'completed',
}) => {
    const t = useTranslations('global')
    return (
        <Card className="p-6">
            <div className="flex items-start justify-between">
                {/* Left side: Icon, Amount, Description */}
                <div className="flex items-center gap-3">
                    <IconBubble {...CONCEPT_ICONS.sendLink} size="m" />
                    <div className="space-y-1">
                        <h1 className="text-heading-card">{title}</h1>
                        {amountDisplay && <h2 className="text-heading-l">$ {amountDisplay}</h2>}

                        {description && (
                            <p className="line-clamp-3 text-body-s text-foreground-secondary">
                                {t('successViewDetailsCard.for', { description })}
                            </p>
                        )}
                    </div>
                </div>

                {/* Right side: Status Badge */}
                {status && <Badge status={status} />}
            </div>
        </Card>
    )
}

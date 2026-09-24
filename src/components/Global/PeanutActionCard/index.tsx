import { useTranslations } from 'next-intl'
import Card from '../Card'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'

interface PeanutActionCardProps {
    type: 'request' | 'send'
}

/**
 * intro card for the link flows, per the Request board (17831:78719) and
 * SendLink board (17832:79996): centered icon bubble, title, sub. Two
 * lines at most (Konrad, 2026-09-23; send card too since QA 2026-09-24).
 */
const PeanutActionCard = ({ type }: PeanutActionCardProps) => {
    const t = useTranslations('global')
    return (
        <Card className="flex flex-col items-center gap-2 p-6 text-center">
            <IconBubble {...CONCEPT_ICONS[type === 'request' ? 'requestLink' : 'sendLink']} size="m" />
            <div className="flex flex-col items-center gap-1">
                <div className="text-heading-card text-foreground-primary">
                    {type === 'request' ? t('peanutActionCard.requestTitle') : t('peanutActionCard.sendTitle')}
                </div>
                <div className="text-body-m text-foreground-secondary">
                    {type === 'request'
                        ? t('peanutActionCard.requestDescription')
                        : t('peanutActionCard.sendDescription')}
                </div>
            </div>
        </Card>
    )
}

export default PeanutActionCard

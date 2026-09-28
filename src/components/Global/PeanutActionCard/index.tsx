import { useTranslations } from 'next-intl'
import Card from '../Card'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { ChatAppsLine } from './ChatAppsLine'

interface PeanutActionCardProps {
    type: 'request' | 'send'
}

/**
 * intro card for the link flows, per the Request board (17831:78719) and
 * SendLink board (17832:79996): centered icon bubble, title, sub. The
 * request card is two lines (Konrad, 2026-09-23); the send card shows the
 * chat-apps line under its title and no description (Hugo, 2026-09-25).
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
                {type === 'send' ? (
                    <ChatAppsLine />
                ) : (
                    <div className="text-body-m text-foreground-secondary">
                        {t('peanutActionCard.requestDescription')}
                    </div>
                )}
            </div>
        </Card>
    )
}

export default PeanutActionCard

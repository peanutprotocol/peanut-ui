import Image from 'next/image'
import { useTranslations } from 'next-intl'
import Card from '../Card'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import SOCIALS_ICON from '@/assets/icons/socials.svg'

interface PeanutActionCardProps {
    type: 'request' | 'send'
}

/**
 * intro card for the link flows, per the Request board (17831:78719) and
 * SendLink board (17832:79996): centered yellow icon bubble, title, sub,
 * socials row.
 */
const PeanutActionCard = ({ type }: PeanutActionCardProps) => {
    const t = useTranslations('global')
    return (
        <Card className="flex flex-col items-center gap-2 p-6 text-center">
            <IconBubble icon={type === 'request' ? 'user-id' : 'link'} size="m" color="yellow" />
            <div className="flex flex-col items-center gap-1">
                <div className="text-heading-card text-foreground-primary">
                    {type === 'request' ? t('peanutActionCard.requestTitle') : t('peanutActionCard.sendTitle')}
                </div>
                <div className="text-body-m text-foreground-secondary">
                    {type === 'request'
                        ? t('peanutActionCard.requestDescription')
                        : t('peanutActionCard.sendDescription')}
                </div>
                <div className="flex items-center gap-1">
                    <Image src={SOCIALS_ICON} alt="Socials" width={32} height={13} />
                    <p className="text-body-s text-foreground-secondary">{t('peanutActionCard.perfectToDm')}</p>
                </div>
            </div>
        </Card>
    )
}

export default PeanutActionCard

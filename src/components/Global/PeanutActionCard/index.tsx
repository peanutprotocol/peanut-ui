import Image from 'next/image'
import { useTranslations } from 'next-intl'
import Card from '../Card'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import SOCIALS_ICON from '@/assets/icons/socials.svg'

interface PeanutActionCardProps {
    type: 'request' | 'send'
}

const PeanutActionCard = ({ type }: PeanutActionCardProps) => {
    const t = useTranslations('global')
    return (
        <Card className="flex items-center gap-3 p-4">
            <IconBubble icon="link" size="s" className="bg-primary-1" />
            <div>
                <div className="font-bold">
                    {type === 'request' ? t('peanutActionCard.requestTitle') : t('peanutActionCard.sendTitle')}
                </div>
                <div className="text-sm text-black">
                    {type === 'request'
                        ? t('peanutActionCard.requestDescription')
                        : t('peanutActionCard.sendDescription')}
                </div>
                <div className="flex items-center gap-1">
                    <Image src={SOCIALS_ICON} alt="Socials" width={32} height={13} />
                    <p className="text-xs text-grey-1">{t('peanutActionCard.perfectToDm')}</p>
                </div>
            </div>
        </Card>
    )
}

export default PeanutActionCard

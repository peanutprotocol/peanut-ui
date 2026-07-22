import Image from 'next/image'
import { useTranslations } from 'next-intl'
import Card from '../Card'
import { Icon } from '../Icons/Icon'
import SOCIALS_ICON from '@/assets/icons/socials.svg'

interface PeanutActionCardProps {
    type: 'request' | 'send'
}

const PeanutActionCard = ({ type }: PeanutActionCardProps) => {
    const t = useTranslations('global')
    return (
        <Card className="flex items-center gap-3 p-4">
            <div className={`flex size-8 items-center justify-center rounded-full bg-primary-1 font-bold`}>
                <Icon name="link" size={16} />
            </div>
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

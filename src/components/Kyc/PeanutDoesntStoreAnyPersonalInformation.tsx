import { useTranslations } from 'next-intl'
import { Icon } from '@/components/Global/Icons/Icon'
import { twMerge } from 'tailwind-merge'

export const PeanutDoesntStoreAnyPersonalInformation = ({ className }: { className?: string }) => {
    const t = useTranslations('kyc')

    return (
        <div className={twMerge('flex items-center gap-2 text-[11px] text-grey-1', className)}>
            <Icon name="info" className="h-3 w-3" />
            <span>{t('doesntStoreDocuments')}</span>
        </div>
    )
}

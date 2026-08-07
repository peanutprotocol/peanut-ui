import { useTranslations } from 'next-intl'
import Card from '@/components/Global/Card'
import StatusBadge, { type StatusType } from '../Global/Badges/StatusBadge'
import { KYCStatusIcon } from './KYCStatusIcon'

export const KYCStatusDrawerItem = ({ status, customText }: { status: StatusType; customText?: string }) => {
    const t = useTranslations('kyc')

    return (
        <Card position="single" className="flex items-center gap-4">
            <KYCStatusIcon />
            <div className="flex flex-col gap-2">
                <h3 className="text-lg font-extrabold">{t('identityVerification')}</h3>
                <StatusBadge status={status} customText={customText} className="w-fit" size="small" />
            </div>
        </Card>
    )
}

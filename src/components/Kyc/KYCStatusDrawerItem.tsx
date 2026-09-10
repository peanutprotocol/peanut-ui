import { useTranslations } from 'next-intl'
import StatusBadge, { type StatusType } from '../Global/Badges/StatusBadge'
import { KYCStatusIcon } from './KYCStatusIcon'

// centered drawer head per the TX Details chrome (board 17490:115877):
// icon bubble → type line → status badge. The rows below it live in the
// state views' receipt Card.
export const KYCStatusDrawerItem = ({ status, customText }: { status: StatusType; customText?: string }) => {
    const t = useTranslations('kyc')

    return (
        <div className="flex flex-col items-center gap-4 text-center">
            <KYCStatusIcon />
            <div className="flex flex-col items-center gap-2">
                <h2 className="text-heading-s text-foreground-primary">{t('identityVerification')}</h2>
                <StatusBadge status={status} customText={customText} className="w-fit" size="small" />
            </div>
        </div>
    )
}

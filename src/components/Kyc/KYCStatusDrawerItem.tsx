import { useTranslations } from 'next-intl'
import Badge, { type StatusType } from '../Global/Badges/Badge'
import { KYCStatusIcon } from './KYCStatusIcon'

// centered drawer head per the TX Details chrome (board 17490:115877):
// icon bubble → type line → status badge. The rows below it live in the
// state views' receipt Card.
export const KYCStatusDrawerItem = ({
    status,
    customText,
    regionRestricted,
}: {
    status: StatusType
    customText?: string
    regionRestricted?: boolean
}) => {
    const t = useTranslations('kyc')

    return (
        <div className="flex flex-col items-center gap-4 text-center">
            <KYCStatusIcon status={status} regionRestricted={regionRestricted} />
            <div className="flex flex-col items-center gap-2">
                <h2 className="text-heading-s text-foreground-primary">{t('identityVerification')}</h2>
                <Badge status={status} customText={customText} className="w-fit" size="small" />
            </div>
        </div>
    )
}

import { useTranslations } from 'next-intl'
import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import { RejectLabelsList } from '../RejectLabelsList'
import InfoCard from '@/components/Global/InfoCard'
import { Button } from '@/components/0_Bruddle/Button'
import type { IconName } from '@/components/Global/Icons/Icon'

// this component shows the identity-verification status when more action is needed
// from the user. Prefers the per-label copy when reject labels are present (e.g.
// DUPLICATE_EMAIL → "Email already in use, sign in to that account or contact
// support") and only falls back to a generic message when there are none. The
// backend's actionMessage (identity.ts → actionMessageFor) is a pure function of
// status — never label-specific — so its PRESENCE is the signal and the copy
// itself comes from the catalog, keyed off the state we're already in.
// RejectLabelsList already renders its own generic fallback for empty labels, so
// the no-labels-no-actionMessage case lands there safely.
export const KycActionRequired = ({
    onResume,
    isLoading,
    actionMessage,
    rejectLabels,
}: {
    onResume: () => void
    isLoading?: boolean
    actionMessage?: string
    rejectLabels?: string[] | null
}) => {
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')

    return (
        <div className="space-y-4 p-1">
            <KYCStatusDrawerItem status="pending" customText={t('actionNeeded')} />

            {!rejectLabels?.length && actionMessage ? (
                <InfoCard variant="info" icon="alert" description={t('actionMessageActionRequired')} />
            ) : (
                <RejectLabelsList rejectLabels={rejectLabels} />
            )}

            <Button
                icon={'retry' as IconName}
                className="w-full"
                shadowSize="4"
                onClick={() => onResume()}
                disabled={isLoading}
            >
                {isLoading ? tCommon('loading') : t('resubmitVerification')}
            </Button>
        </div>
    )
}

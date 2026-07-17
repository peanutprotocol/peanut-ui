import { useTranslations } from 'next-intl'
import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import { RejectLabelsList } from '../RejectLabelsList'
import InfoCard from '@/components/Global/InfoCard'
import { Button } from '@/components/0_Bruddle/Button'
import type { IconName } from '@/components/Global/Icons/Icon'

// this component shows the identity-verification status when more action is needed
// from the user. Prefers the per-label copy when reject labels are present (e.g.
// DUPLICATE_EMAIL → "Email already in use, sign in to that account or contact
// support") and only falls back to the backend's generic actionMessage when there
// are none. The backend (identity.ts → actionMessageFor) sends a fixed, generic
// "resubmit your documents" message for every action_required state — it is never
// label-specific — so checking it first would mask the actionable per-label copy.
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
                <InfoCard variant="info" icon="alert" description={actionMessage} />
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

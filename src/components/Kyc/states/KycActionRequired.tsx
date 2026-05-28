import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import { RejectLabelsList } from '../RejectLabelsList'
import InfoCard from '@/components/Global/InfoCard'
import { Button } from '@/components/0_Bruddle/Button'
import type { IconName } from '@/components/Global/Icons/Icon'

// this component shows the identity-verification status when more action is needed
// from the user. Displays a friendly actionMessage when present, otherwise the
// normalized reject labels (e.g. bad photo quality, expired doc).
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
    return (
        <div className="space-y-4 p-1">
            <KYCStatusDrawerItem status="pending" customText="Action needed" />

            {actionMessage ? (
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
                {isLoading ? 'Loading...' : 'Re-submit verification'}
            </Button>
        </div>
    )
}

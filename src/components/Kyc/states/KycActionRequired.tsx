import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import { RejectLabelsList } from '../RejectLabelsList'
import { Button } from '@/components/0_Bruddle/Button'
import type { IconName } from '@/components/Global/Icons/Icon'

// this component shows the kyc status when sumsub requires additional action from the user.
// displays specific rejection reasons when available (e.g. bad photo quality, expired doc).
export const KycActionRequired = ({
    onResume,
    isLoading,
    rejectLabels,
}: {
    onResume: () => void
    isLoading?: boolean
    rejectLabels?: string[] | null
}) => {
    return (
        <div className="space-y-4 p-1">
            <KYCStatusDrawerItem status="pending" customText="Action needed" />

            <RejectLabelsList rejectLabels={rejectLabels} />

            <Button
                icon={'retry' as IconName}
                className="w-full"
                shadowSize="4"
                onClick={onResume}
                disabled={isLoading}
            >
                {isLoading ? 'Loading...' : 'Re-submit verification'}
            </Button>
        </div>
    )
}

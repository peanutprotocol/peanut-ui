import InfoCard from '@/components/Global/InfoCard'
import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import { Button } from '@/components/0_Bruddle/Button'

// shown when user initiated kyc but abandoned before submitting documents.
// provides a cta to resume the verification flow.
export const KycNotStarted = ({ onResume, isLoading }: { onResume: () => void; isLoading?: boolean }) => {
    return (
        <div className="space-y-4 p-1">
            <KYCStatusDrawerItem status="pending" customText="Not completed" />

            <InfoCard
                variant="info"
                description="Your verification isn't complete yet. Continue where you left off to enable bank transfers and QR
                payments."
            />

            <Button className="w-full" shadowSize="4" onClick={onResume} disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Continue verification'}
            </Button>
        </div>
    )
}

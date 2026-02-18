import { Button } from '@/components/0_Bruddle/Button'
import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import InfoCard from '@/components/Global/InfoCard'

// this component shows the kyc status when sumsub requires additional action from the user.
export const KycActionRequired = ({ onResume, isLoading }: { onResume: () => void; isLoading?: boolean }) => {
    return (
        <div className="space-y-4">
            <KYCStatusDrawerItem status="pending" customText="Action needed" />
            <InfoCard
                variant="warning"
                icon="alert"
                description="We need more information to complete your verification. Please provide the requested details to continue."
            />
            <Button
                icon="arrow-right"
                variant="purple"
                className="w-full"
                shadowSize="4"
                onClick={onResume}
                disabled={isLoading}
            >
                {isLoading ? 'Loading...' : 'Continue verification'}
            </Button>
        </div>
    )
}

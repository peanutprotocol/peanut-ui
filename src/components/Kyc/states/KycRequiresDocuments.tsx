import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import { Button } from '@/components/0_Bruddle/Button'
import { getRequirementLabel } from '@/constants/bridge-requirements.consts'

// shows when a payment provider (bridge) needs additional documents from the user.
// displays the specific requirements with human-readable descriptions.
export const KycRequiresDocuments = ({
    requirements,
    onSubmitDocuments,
    isLoading,
}: {
    requirements: string[]
    onSubmitDocuments: () => void
    isLoading?: boolean
}) => {
    return (
        <div className="space-y-4 p-1">
            <KYCStatusDrawerItem status="pending" customText="Additional documents needed" />

            <div className="space-y-3">
                <p className="text-sm text-gray-1">Your payment provider requires additional verification documents.</p>
                {requirements.length > 0 ? (
                    requirements.map((req) => {
                        const label = getRequirementLabel(req)
                        return (
                            <div key={req} className="border border-n-1 p-3">
                                <p className="text-sm font-bold">{label.title}</p>
                                <p className="mt-1 text-xs text-gray-1">{label.description}</p>
                            </div>
                        )
                    })
                ) : (
                    <div className="border border-n-1 p-3">
                        <p className="text-sm font-bold">Additional Document</p>
                        <p className="mt-1 text-xs text-gray-1">Please provide the requested document.</p>
                    </div>
                )}
            </div>

            <Button
                icon="docs"
                className="w-full"
                shadowSize="4"
                onClick={onSubmitDocuments}
                disabled={isLoading}
            >
                {isLoading ? 'Loading...' : 'Submit documents'}
            </Button>
        </div>
    )
}

import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import { Button } from '@/components/0_Bruddle/Button'
import InfoCard from '@/components/Global/InfoCard'
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
            <KYCStatusDrawerItem status="pending" customText="Action needed" />

            <div className="space-y-3">
                <p className="text-xs text-gray-1">Our payment provider requires additional verification documents.</p>
                {requirements.length > 0 ? (
                    requirements.map((req) => {
                        const label = getRequirementLabel(req)
                        return (
                            <InfoCard
                                variant="info"
                                key={label.title}
                                description={label.description}
                                title={label.title}
                            />
                        )
                    })
                ) : (
                    <InfoCard
                        variant="info"
                        title={'Additional Document'}
                        description={'Please provide the requested document.'}
                    />
                )}
            </div>

            <Button icon="docs" className="w-full" shadowSize="4" onClick={onSubmitDocuments} disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Submit documents'}
            </Button>
        </div>
    )
}

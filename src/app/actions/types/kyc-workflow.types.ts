import type { paths } from '@/types/api.generated'

export type KycDocumentPlan = paths['/users/kyc/plan']['get']['responses'][200]['content']['application/json']
export type KycFeatures = KycDocumentPlan['features']
type AttemptResponse = paths['/users/kyc/attempts']['post']['responses'][200]['content']['application/json']
export type KycDocumentConfig = AttemptResponse['sdkConfig']
// A usable SDK session has a real applicant. The action validates that boundary before returning it.
export type KycAttemptSession = Omit<AttemptResponse, 'applicantId'> & { applicantId: string }
export type KycDocumentChoice =
    paths['/users/kyc/attempts']['post']['requestBody']['content']['application/json']['documents'][number]
type SavedKycFeatures = NonNullable<
    paths['/users/kyc-intents']['put']['responses'][200]['content']['application/json']['features']
>
// Typed here until the API types are regenerated: refusals gain requirement reasons and a step to start.
export type KycFeatureReport = {
    state: SavedKycFeatures[keyof SavedKycFeatures]['state']
    reason?: string
    action?: string
}
export type KycFeatureReports = Record<keyof KycFeatures, KycFeatureReport>
export type KycProfile = paths['/users/kyc/profile']['get']['responses'][200]['content']['application/json']

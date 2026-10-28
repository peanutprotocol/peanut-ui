import type { paths } from '@/types/api.generated'

type DocumentPlanResponse = paths['/users/kyc/plan']['get']['responses'][200]['content']['application/json']
/** What an older account still has to answer before Smart Paperwork Verification can ask its questions. */
export type KycPlanNeed = DocumentPlanResponse['needs'][number]
/** Smart Paperwork Verification's stored `flow` value; the API keeps it on existing attempts. */
export const PAPERWORK_VERIFICATION_FLOW = 'verify-once'
// `needs` and the picker annotations are optional for a response from an API before the field.
// `flow` is written out because the API snapshot still lists the dropped 'document-first'.
export type KycDocumentPlan = Omit<
    DocumentPlanResponse,
    | 'flow'
    | 'proofOfAddress'
    | 'proofOfAddressReason'
    | 'proofOfAddressIdCountries'
    | 'documentRefusals'
    | 'temporaryProtection'
    | 'needs'
> &
    Partial<
        Pick<
            DocumentPlanResponse,
            | 'proofOfAddress'
            | 'proofOfAddressReason'
            | 'proofOfAddressIdCountries'
            | 'documentRefusals'
            | 'temporaryProtection'
            | 'needs'
        >
    > & { flow?: typeof PAPERWORK_VERIFICATION_FLOW | null }
export type KycFeatures = KycDocumentPlan['features']
type AttemptResponse =
    paths['/users/kyc/attempts/{attemptId}/token']['post']['responses'][200]['content']['application/json']
export type KycDocumentConfig = AttemptResponse['sdkConfig']
// A usable SDK session has a real applicant. The action validates that boundary before returning it.
export type KycAttemptSession = Omit<AttemptResponse, 'applicantId'> & { applicantId: string }
type IdentityRestartBody = NonNullable<
    paths['/users/identity/restart']['post']['requestBody']
>['content']['application/json']
/** The documents a restart of an attempt-based identity names, as the restart route validates them. */
export type KycReplacementChoices = NonNullable<IdentityRestartBody['replacement']>
type SavedKycFeatures = NonNullable<
    paths['/users/kyc-intents']['put']['responses'][200]['content']['application/json']['features']
>
export type KycFeatureReport = {
    state: SavedKycFeatures[keyof SavedKycFeatures]['state']
    reason?: string
    action?: string
}
export type KycFeatureReports = Record<keyof KycFeatures, KycFeatureReport>
export type KycProfile = paths['/users/kyc/profile']['get']['responses'][200]['content']['application/json']

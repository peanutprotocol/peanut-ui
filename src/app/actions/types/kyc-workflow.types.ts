import type { paths } from '@/types/api.generated'

export type KycDocumentPlan = paths['/users/kyc/plan']['get']['responses'][200]['content']['application/json']
export type KycFeatures = KycDocumentPlan['features']
type AttemptResponse = paths['/users/kyc/attempts']['post']['responses'][200]['content']['application/json']
export type KycDocumentConfig = AttemptResponse['sdkConfig']
// A usable SDK session has a real applicant. The action validates that boundary before returning it.
export type KycAttemptSession = Omit<AttemptResponse, 'applicantId'> & { applicantId: string }
export type KycDocumentChoice =
    paths['/users/kyc/attempts']['post']['requestBody']['content']['application/json']['documents'][number]

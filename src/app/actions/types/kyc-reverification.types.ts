import type { paths } from '@/types/api.generated'

type IdentityConflict = paths['/users/identity']['post']['responses'][409]['content']['application/json']
export type FeatureReverificationConflict = Extract<IdentityConflict, { code: 'feature_reverification_required' }>

type PlanGet = paths['/users/kyc/plan']['get']
export type FeatureReverificationEntry = NonNullable<PlanGet['responses'][200]['content']['application/json']['entry']>
export type KycPlanFeature = NonNullable<NonNullable<PlanGet['parameters']['query']>['feature']>

type ReverificationPost = paths['/users/kyc/reverification']['post']
export type FeatureReverificationStartBody = ReverificationPost['requestBody']['content']['application/json']
type StartResponse = ReverificationPost['responses'][200]['content']['application/json']
type StartConflict = ReverificationPost['responses'][409]['content']['application/json']
export type FeatureReverificationStartConflictCode = StartConflict['code']
export type FeatureReverificationOutcome = Extract<StartConflict, { code: 'reverification_finished' }>['outcome']

type Profile = paths['/users/kyc/profile']['get']['responses'][200]['content']['application/json']
export type FeatureReverificationStatus = Profile['attempts'][number]['status']
// Narrow the status and attempt IDs at the response boundary.
export type FeatureReverificationStart = Omit<StartResponse, 'status' | 'entry'> & {
    status: FeatureReverificationStatus
    entry: FeatureReverificationEntry & { attemptId: string }
}
export type FeatureReverificationRefreshNotActive =
    paths['/users/kyc/identity/refresh']['post']['responses'][404]['content']['application/json']

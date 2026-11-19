import type { PaperworkVerificationFeature } from './kyc-paperwork-verification.types'
import type { paths } from '@/types/api.generated'

// Handwritten until the API's re-verification OpenAPI changes are synced.
export interface FeatureReverificationEntry {
    kind: 'reverify_for_feature'
    feature: PaperworkVerificationFeature
    targetProvider: 'RAIN' | 'BRIDGE' | 'MANTECA' | 'AVENIA'
    attemptId: string | null
}

export interface FeatureReverificationConflict {
    code: 'feature_reverification_required'
    userMessage: string
    message: string
    error: string
    entry: FeatureReverificationEntry
}

export interface FeatureReverificationStartBody {
    feature: PaperworkVerificationFeature
    requestKey: string
}

type Profile = paths['/users/kyc/profile']['get']['responses'][200]['content']['application/json']
export type FeatureReverificationStatus = Profile['attempts'][number]['status']

export interface FeatureReverificationStart {
    attemptId: string
    status: FeatureReverificationStatus
    entry: FeatureReverificationEntry & { attemptId: string }
}

import type { KycFeatures, KycFeatureReports } from '@/app/actions/types/kyc-workflow.types'

type RefusalCopy = 'supplement.uncollectable' | 'supplement.identityDocumentInsufficient' | 'supplement.unavailable'
const REFUSAL_COPY = new Map<string | undefined, RefusalCopy>([
    ['requirements_uncollectable', 'supplement.uncollectable'],
    ['identity_document_insufficient', 'supplement.identityDocumentInsufficient'],
])

export const kycFeatureRefusalCopy = (reason?: string): RefusalCopy =>
    REFUSAL_COPY.get(reason) ?? 'supplement.unavailable'

/** What an approved user must do after saving features, beyond waiting for providers. */
export function savedFeaturesOutcome(
    features: KycFeatures,
    before: KycFeatures,
    reports: KycFeatureReports | undefined
): { action: string } | { feature: keyof KycFeatures; copy: RefusalCopy } | { ready: keyof KycFeatures } | null {
    if (!reports) return null
    const keys = (Object.keys(features) as (keyof KycFeatures)[]).filter((key) => features[key])
    const action = keys
        .map((key) => reports[key])
        .find((report) => report?.state === 'action_required' && report.action?.startsWith('supplement:'))?.action
    if (action) return { action }
    for (const key of keys) {
        const copy =
            features[key] !== before[key] && reports[key]?.state === 'refused'
                ? kycFeatureRefusalCopy(reports[key].reason)
                : undefined
        if (copy) return { feature: key, copy }
    }
    const ready = keys.find((key) => features[key] !== before[key] && reports[key]?.state === 'ready')
    if (ready) return { ready }
    return null
}

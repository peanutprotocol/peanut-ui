import type { paths } from '@/types/api.generated'
import { serverFetch } from '@/utils/api-fetch'
import { kycClientHeaders } from '@/utils/kyc-client-headers'

type Activation = paths['/users/kyc/features/{feature}/activate']['post']
export type KycActivationFeature = Activation['parameters']['path']['feature']
export type KycActivationReport = Activation['responses'][200]['content']['application/json']
type Conflict = Activation['responses'][409]['content']['application/json']
export type KycFeatureActivationResult =
    | { kind: 'report'; report: KycActivationReport }
    | ({ kind: 'conflict' } & Conflict)
    | { kind: 'failed' }

const FEATURES: ReadonlySet<string> = new Set<KycActivationFeature>(['qr', 'bank', 'local', 'card'])
const STATES: ReadonlySet<string> = new Set<KycActivationReport['state']>([
    'ready',
    'on',
    'setting_up',
    'pending',
    'action_required',
    'refused',
    'not_requested',
])
const CONFLICTS: ReadonlySet<string> = new Set<Conflict['code']>([
    'identity_not_approved',
    'feature_not_open',
    'questions_missing',
])

export async function activateKycFeature(feature: KycActivationFeature): Promise<KycFeatureActivationResult> {
    if (!FEATURES.has(feature)) return { kind: 'failed' }
    try {
        const response = await serverFetch(`/users/kyc/features/${feature}/activate`, {
            method: 'POST',
            headers: kycClientHeaders(),
            cache: 'no-store',
            redactTelemetry: true,
        })
        const body = await response.json()
        if (!body || typeof body !== 'object' || Array.isArray(body)) return { kind: 'failed' }
        if (
            response.status === 200 &&
            STATES.has(body.state) &&
            (body.action === undefined || typeof body.action === 'string') &&
            (body.reason === undefined || typeof body.reason === 'string')
        )
            return { kind: 'report', report: body as KycActivationReport }
        if (
            response.status === 409 &&
            CONFLICTS.has(body.code) &&
            (body.step === undefined || typeof body.step === 'string')
        )
            return { kind: 'conflict', code: body.code, ...(body.step === undefined ? {} : { step: body.step }) }
    } catch {
        return { kind: 'failed' }
    }
    return { kind: 'failed' }
}

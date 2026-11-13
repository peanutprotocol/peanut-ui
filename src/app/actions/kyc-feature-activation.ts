import * as Sentry from '@/utils/sentry-lazy'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'
import type { paths } from '@/types/api.generated'
import { serverFetch } from '@/utils/api-fetch'
import { kycClientHeaders } from '@/utils/kyc-client-headers'
import type { NextAction } from '@/types/capabilities'

type Activation = paths['/users/kyc/features/{feature}/activate']['post']
export type KycActivationFeature = Activation['parameters']['path']['feature']
export type KycActivationReport = Activation['responses'][200]['content']['application/json'] & {
    /**
     * The step a first use waits on, where it is not a supplement: a legacy approval's corridor
     * verification (`verify-corridor:pix_br`, API-CONTRACT.md 4a). Not in the API snapshot yet.
     */
    nextAction?: NextAction
}
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
    let status: number | undefined
    try {
        const response = await serverFetch(`/users/kyc/features/${feature}/activate`, {
            method: 'POST',
            headers: kycClientHeaders(),
            cache: 'no-store',
            redactTelemetry: true,
        })
        status = response.status
        const body = await response.json()
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            if (!(status >= 400 && status < 500))
                Sentry.captureException(new Error('Invalid KYC activation response'), {
                    tags: { ...criticalFlowTags('kyc'), kyc_step: 'feature_activation' },
                })
            return { kind: 'failed' }
        }
        if (
            response.status === 200 &&
            STATES.has(body.state) &&
            (body.action === undefined || typeof body.action === 'string') &&
            (body.reason === undefined || typeof body.reason === 'string') &&
            (body.nextAction === undefined || isNextAction(body.nextAction))
        )
            return { kind: 'report', report: body as KycActivationReport }
        if (
            response.status === 409 &&
            CONFLICTS.has(body.code) &&
            (body.step === undefined || typeof body.step === 'string')
        )
            return { kind: 'conflict', code: body.code, ...(body.step === undefined ? {} : { step: body.step }) }
        if (!(status >= 400 && status < 500))
            Sentry.captureException(new Error('KYC activation failed'), {
                tags: { ...criticalFlowTags('kyc'), kyc_step: 'feature_activation' },
            })
    } catch (error) {
        if (!(status !== undefined && status >= 400 && status < 500))
            Sentry.captureException(error, { tags: { ...criticalFlowTags('kyc'), kyc_step: 'feature_activation' } })
        return { kind: 'failed' }
    }
    return { kind: 'failed' }
}

/** A next action the app can start: an object with its key and kind. */
function isNextAction(value: unknown): value is NextAction {
    if (!value || typeof value !== 'object') return false
    const { key, kind } = value as Record<string, unknown>
    return typeof key === 'string' && typeof kind === 'string'
}

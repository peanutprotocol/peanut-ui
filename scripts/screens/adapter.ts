/** Capture-only API adapter. No historical components or styles are copied. */
import { demoRespond } from '../../src/utils/demo-api'
import { KYC_USER_READS } from '../../src/utils/demo-kyc'
import { FIXTURES } from '../../src/dev/fixtures/registry'
import { withFixtureFeatureReport } from '../../src/dev/fixtures/featureReport'
import type { IUserProfile } from '../../src/interfaces/interfaces'
import openapi from '../../src/types/api.openapi.json'
import { exampleFor } from './openapi-example'
export const ADAPTER_VERSION = 'synthetic-api-v6'
export function merge(base: unknown, patch: unknown): unknown {
    if (
        !base ||
        !patch ||
        typeof base !== 'object' ||
        typeof patch !== 'object' ||
        Array.isArray(base) ||
        Array.isArray(patch)
    )
        return patch
    const result = { ...base } as Record<string, unknown>
    for (const [key, value] of Object.entries(patch)) result[key] = merge(result[key], value)
    return result
}
/** Demo handlers first; a route they do not map gets its documented example, or stays unmapped. */
async function synthetic(path: string, method: string, body: string | undefined, spec: unknown): Promise<Response> {
    try {
        return await demoRespond(path, { method, body }, { offline: true, strict: true })
    } catch (error) {
        const unmapped = error instanceof Error && error.message.startsWith('Unmapped capture API:')
        const example = unmapped ? exampleFor(spec, method, path) : undefined
        if (!example) throw error
        return Response.json(example.data, { status: example.status })
    }
}
export async function answer(
    fixture: string,
    path: string,
    method: string,
    body?: string,
    spec: unknown = openapi
): Promise<Response> {
    const state = FIXTURES[fixture]
    if (!state) throw new Error(`Unknown fixture ${fixture}`)
    const key = `${method} ${path.split('?')[0].replace(/\/+$/, '')}`
    if (state.fails?.includes(key)) return Response.json({ error: 'Synthetic failure' }, { status: 500 })
    const rejection = state.rejects?.[key]
    if (rejection) return Response.json(rejection.body, { status: rejection.status })
    if (
        (key === 'POST /users/username/reservations' || key.startsWith('HEAD /users/username/')) &&
        state.responses?.[key] !== undefined
    )
        return Response.json(state.responses?.[key])
    const activationFixtureRoute =
        /^POST \/users\/kyc\/features\/(qr|bank|local|card)\/activate$/.test(key) ||
        key === 'GET /users/kyc/questions' ||
        key === 'GET /users/kyc/plan' ||
        key === 'GET /users/kyc/profile' ||
        key === 'POST /users/kyc/start-action'
    if (activationFixtureRoute && fixture.startsWith('feature-activation-') && state.responses?.[key] !== undefined)
        return Response.json(state.responses[key])
    // The KYC reads that follow from the user, read off this fixture's own /users/me.
    const userRead = KYC_USER_READS[key]
    if (userRead) {
        const user = (await (await answer(fixture, '/users/me', 'GET')).json()) as IUserProfile | null
        const override = state.responses?.[key]
        return Response.json(override === undefined ? userRead(user) : merge(userRead(user), override))
    }
    if (key === 'GET /notifications') return Response.json({ items: [], nextCursor: null })
    if (key === 'POST /invites/validate')
        return Response.json({ success: true, attributionResolved: true, onboardingResolved: true, username: 'demo' })
    if (key === 'GET /qr/synthetic-invalid') return Response.json({ claimed: false, available: false })
    if (key === 'GET /qr/synthetic-success')
        return Response.json({ claimed: true, available: false, claimedAt: '2026-09-01T12:00:00Z' })
    if (key === 'GET /bridge/onramp/quote') {
        const query = new URL(path, 'http://capture.invalid').searchParams
        const from = query.get('accountType')?.includes('iban') ? 'EUR' : 'USD'
        return Response.json({
            from,
            to: 'USD',
            grossRate: '1',
            netRate: '1',
            peanutFee: '0.0000',
            updatedAt: '2026-09-01T12:00:00Z',
            ...(query.has('sourceAmount') ? { netAmount: query.get('sourceAmount') } : {}),
        })
    }
    const base = await synthetic(path, method, body, spec)
    let data = await base.json()
    if (key === 'GET /users/me') data = merge(data, { user: { activationCelebratedAt: '2026-01-01T00:00:00Z' } })
    const override = state.responses?.[key]
    let merged = override === undefined ? data : merge(data, override)
    if (key === 'GET /users/me') {
        // Paperwork metadata is optional on older/minimal capture specs. Its
        // absence must not break a mapped users/me read.
        const paperworkBase = await synthetic('/users/kyc/paperwork', 'GET', undefined, spec).catch(
            (error: unknown) => {
                if (error instanceof Error && error.message.startsWith('Unmapped capture API:')) return null
                throw error
            }
        )
        const paperworkData = paperworkBase ? await paperworkBase.json() : {}
        const paperworkOverride = state.responses?.['GET /users/kyc/paperwork']
        const paperwork = paperworkOverride === undefined ? paperworkData : merge(paperworkData, paperworkOverride)
        merged = withFixtureFeatureReport(
            merged as IUserProfile | null,
            override as Partial<IUserProfile> | null,
            paperwork as Parameters<typeof withFixtureFeatureReport>[2]
        )
    }
    return Response.json(merged, { status: base.status })
}

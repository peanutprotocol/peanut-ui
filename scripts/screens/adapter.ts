/** Capture-only API adapter. No historical components or styles are copied. */
import { demoRespond } from '../../src/utils/demo-api'
import { KYC_USER_READS } from '../../src/utils/demo-kyc'
import { FIXTURES } from '../../src/dev/fixtures/registry'
import { withFixtureFeatureReport, withFixtureRoutes } from '../../src/dev/fixtures/featureReport'
import type { IUserProfile } from '../../src/interfaces/interfaces'
import openapi from '../../src/types/api.openapi.json'
import { exampleFor } from './openapi-example'
export const ADAPTER_VERSION = 'synthetic-api-v7'
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
function reply(method: string, status: number, data?: unknown): Response {
    return method === 'HEAD' || status === 204 || status === 205 || status === 304
        ? new Response(null, { status })
        : Response.json(data, { status })
}

const unmapped = (error: unknown) => error instanceof Error && error.message.startsWith('Unmapped capture API:')

async function mappedDemo(path: string, method: string, body?: string): Promise<Response | undefined> {
    try {
        return await demoRespond(path, { method, body }, { offline: true, strict: true })
    } catch (error) {
        if (!unmapped(error)) throw error
        return undefined
    }
}

/** Preserve partial fixture overlays on a mapped demo read and complete fixture answers on other reads. */
async function synthetic(
    path: string,
    method: string,
    body: string | undefined,
    spec: unknown,
    override?: unknown
): Promise<Response> {
    const demo = await mappedDemo(path, method, body)
    if (demo) return demo
    if (override !== undefined) return reply(method, 200, override)
    const example = exampleFor(spec, method, path)
    if (example) return reply(method, example.status, example.data)
    throw new Error(`Unmapped capture API: ${method} ${path.split('?')[0].replace(/\/+$/, '')}`)
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
    method = method.toUpperCase()
    const key = `${method} ${path.split('?')[0].replace(/\/+$/, '')}`
    if (state.fails?.includes(key)) return reply(method, 500, { error: 'Synthetic failure' })
    const rejection = state.rejects?.[key]
    if (rejection) return reply(method, rejection.status, rejection.body)
    const override = state.responses?.[key]
    if (override !== undefined && (method === 'HEAD' || state.completeResponses?.includes(key)))
        return reply(method, 200, override)
    if (method === 'HEAD') {
        const demo = await mappedDemo(path, method)
        if (demo) return reply(method, demo.status)
        // HEAD uses the same fixture or demo resource as GET, including an absent username.
        // Consult explicit contract examples only after those sources have no answer.
        try {
            return reply(method, (await answer(fixture, path, 'GET', undefined, {})).status)
        } catch (error) {
            if (!unmapped(error)) throw error
        }
        const documented = exampleFor(spec, method, path) ?? exampleFor(spec, 'GET', path)
        if (documented) return reply(method, documented.status)
        throw new Error(`Unmapped capture API: ${key}`)
    }
    // The KYC reads that follow from the user, read off this fixture's own /users/me.
    const userRead = KYC_USER_READS[key]
    if (userRead) {
        const user = (await (await answer(fixture, '/users/me', 'GET', undefined, spec)).json()) as IUserProfile | null
        return Response.json(override === undefined ? userRead(user) : merge(userRead(user), override))
    }
    const base = await synthetic(path, method, body, spec, override)
    if (!base.body) return base
    let data = await base.json()
    if (key === 'GET /users/me') data = merge(data, { user: { activationCelebratedAt: '2026-01-01T00:00:00Z' } })
    let merged = override === undefined ? data : merge(data, override)
    if (key === 'GET /users/me') {
        // Paperwork metadata is optional on older/minimal capture specs. Its
        // absence must not break a mapped users/me read.
        const paperworkBase = await synthetic('/users/kyc/paperwork', 'GET', undefined, spec).catch(
            (error: unknown) => {
                if (unmapped(error)) return null
                throw error
            }
        )
        const paperworkData = paperworkBase ? await paperworkBase.json() : {}
        const paperworkOverride = state.responses?.['GET /users/kyc/paperwork']
        const paperwork = paperworkOverride === undefined ? paperworkData : merge(paperworkData, paperworkOverride)
        merged = withFixtureRoutes(
            withFixtureFeatureReport(
                merged as IUserProfile | null,
                override as Partial<IUserProfile> | null,
                paperwork as Parameters<typeof withFixtureFeatureReport>[2]
            ),
            override as Partial<IUserProfile> | null
        )
    }
    return Response.json(merged, { status: base.status })
}

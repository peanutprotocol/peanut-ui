/** Frozen spec-only assertions; adapter must mount actual CardPage/YourCardScreen/SDK. */
import { afterEach, describe, expect, test } from '@jest/globals'
import { within } from '@testing-library/dom'
import { issuedCardOverview, USER, GENERATION, SCOPE } from '../peanut-addon-ui-spec/fixtures'
import type { ContinuityView, Overview, VerificationContext } from './ui-adapter-contract'
import { mountCardContinuity } from './card-continuity-real-render-adapter'
let view: ContinuityView | undefined
const context = (status: 'open' | 'checking'): VerificationContext => ({
    status,
    generation: GENERATION,
    entryScope: SCOPE,
})
function overview(state: 'open' | 'checking' | 'none' | 'unavailable' | 'omitted'): Overview {
    const value: Overview = issuedCardOverview()
    if (state !== 'open') delete value.pendingVerification
    if (state === 'open' || state === 'checking') value.verificationContext = context(state)
    else if (state !== 'omitted') value.verificationContext = { status: state }
    return value
}
const active = (v: ContinuityView) => v.sdk.sessions.filter((s) => s.mounted)
const requests = (v: ContinuityView, kind: string) => v.requests.filter((r) => r.kind === kind)
const cta = (v: ContinuityView) => within(v.root).queryByText(/^complete verification$/i)
async function mount(state: Parameters<typeof overview>[0] = 'open') {
    view = await mountCardContinuity({ session: { userId: USER }, overview: overview(state) })
    await view.settle()
    return view
}
async function begin(v: ContinuityView) {
    const pending = v.deferNextResume()
    expect(cta(v)).not.toBeNull()
    await v.tap(cta(v)!)
    await v.settle()
    return pending
}
async function start(v: ContinuityView) {
    const pending = await begin(v)
    await pending.reply(200, { token: 'start-token' })
    await v.settle()
    expect(active(v)).toHaveLength(1)
    return active(v)[0].id
}
async function poll(v: ContinuityView, next: Overview, mode: 'interval' | 'focus') {
    const before = requests(v, 'overview').length
    v.setOverviewResponse(next)
    if (mode === 'interval') await v.advanceTime(30_001)
    else await v.focusWindow()
    await v.settle()
    expect(requests(v, 'overview').length).toBeGreaterThan(before)
}
afterEach(async () => {
    if (view) {
        try {
            expect(view.forbiddenCalls).toEqual([])
            expect(view.requests.filter((r) => ['apply', 'create-card', 'issuance'].includes(r.kind))).toEqual([])
        } finally {
            await view.dispose()
            view = undefined
        }
    }
})

describe('actual card polling preserves only the captured continuation', () => {
    test.each(['checking', 'none', 'unavailable', 'omitted'] as const)(
        '%s cannot advertise or start a new continuation',
        async (state) => {
            const v = await mount(state)
            expect(cta(v)).toBeNull()
            expect(requests(v, 'resume')).toEqual([])
            expect(v.sdk.sessions).toEqual([])
        }
    )
    for (const mode of ['interval', 'focus'] as const)
        for (const state of ['checking', 'open', 'unavailable', 'omitted'] as const) {
            test(`${mode} ${state} preserves an already mounted session without another start`, async () => {
                const v = await mount()
                const id = await start(v)
                await poll(v, overview(state), mode)
                expect(active(v).map((s) => s.id)).toEqual([id])
                expect(v.sdk.sessions).toHaveLength(1)
                expect(requests(v, 'resume')).toHaveLength(1)
                if (state !== 'open') expect(cta(v)).toBeNull()
            })
            test(`${mode} ${state} permits the captured delayed start`, async () => {
                const v = await mount()
                const pending = await begin(v)
                await poll(v, overview(state), mode)
                await pending.reply(200, { token: 'late-valid-token' })
                await v.settle()
                expect(active(v)).toHaveLength(1)
                expect(active(v)[0].token).toBe('late-valid-token')
                expect(requests(v, 'resume')).toHaveLength(1)
            })
            test(`${mode} ${state} permits the captured delayed refresh`, async () => {
                const v = await mount()
                const id = await start(v)
                const pending = v.deferNextResume()
                const outcome = v.sdk.refresh(id)
                await v.settle()
                await poll(v, overview(state), mode)
                await pending.reply(200, { token: 'late-valid-refresh' })
                expect(await outcome).toBe('late-valid-refresh')
                await v.settle()
                expect(active(v).map((s) => s.id)).toEqual([id])
                expect(v.sdk.sessions).toHaveLength(1)
                expect(requests(v, 'resume')).toHaveLength(2)
            })
        }
    test('checking refresh uses the original binding and remains mounted across focus', async () => {
        const v = await mount()
        const id = await start(v)
        await poll(v, overview('checking'), 'interval')
        const pending = v.deferNextResume()
        const result = v.sdk.refresh(id)
        await v.settle()
        const request = requests(v, 'resume')[1]
        expect(request.body).toEqual({ generation: GENERATION })
        expect(request.headers['x-kyc-entry-user']).toBe(USER)
        expect(request.headers['x-kyc-entry-scope']).toBe(SCOPE)
        await poll(v, overview('checking'), 'focus')
        await pending.reply(200, { token: 'refresh-token' })
        expect(await result).toBe('refresh-token')
        await v.settle()
        expect(active(v).map((s) => s.id)).toEqual([id])
    })
    test.each(['close', 'complete'] as const)('%s clears a held session and refetches both reads', async (event) => {
        const v = await mount()
        const id = await start(v)
        await poll(v, overview('checking'), 'interval')
        const cardsBefore = requests(v, 'overview').length,
            profileBefore = requests(v, 'profile').length
        await v.sdk[event](id)
        await v.settle()
        expect(active(v)).toEqual([])
        expect(cta(v)).toBeNull()
        expect(requests(v, 'overview').length).toBeGreaterThan(cardsBefore)
        expect(requests(v, 'profile').length).toBeGreaterThan(profileBefore)
        await poll(v, overview('checking'), 'focus')
        expect(active(v)).toEqual([])
        expect(requests(v, 'resume')).toHaveLength(1)
    })
    for (const mode of ['interval', 'focus'] as const) {
        test(`${mode} authoritative none closes an existing SDK`, async () => {
            const v = await mount()
            await start(v)
            await poll(v, overview('none'), mode)
            expect(active(v)).toEqual([])
            expect(v.sdk.sessions).toHaveLength(1)
            expect(cta(v)).toBeNull()
            expect(requests(v, 'resume')).toHaveLength(1)
        })
    }
})

type Change = 'none' | 'generation' | 'scope' | 'account' | 'sign-out' | 'auth-epoch' | 'navigation'
const changes: Change[] = ['none', 'generation', 'scope', 'account', 'sign-out', 'auth-epoch', 'navigation']
async function invalidate(v: ContinuityView, change: Change) {
    if (change === 'account') await v.setSession({ userId: 'user-b' })
    else if (change === 'sign-out') await v.setSession(null)
    else if (change === 'auth-epoch') {
        await v.setSession(null)
        await v.settle()
        await v.setSession({ userId: USER })
    } else if (change === 'navigation') await v.navigateAway()
    else {
        const next = overview('checking')
        if (change === 'none') next.verificationContext = { status: 'none' }
        if (change === 'generation')
            next.verificationContext = { status: 'checking', generation: 'generation-b', entryScope: SCOPE }
        if (change === 'scope')
            next.verificationContext = { status: 'checking', generation: GENERATION, entryScope: 'b'.repeat(64) }
        await v.publishOverview(next)
    }
    await v.settle()
}
describe('authoritative removal and session guards survive continuity', () => {
    test.each(changes)('%s prevents delayed start', async (change) => {
        const v = await mount()
        const pending = await begin(v)
        await invalidate(v, change)
        await pending.reply(200, { token: 'stale-start' })
        await v.settle()
        expect(active(v)).toEqual([])
        expect(v.sdk.sessions).toEqual([])
    })
    test.each(changes)('%s unmounts SDK and rejects delayed refresh', async (change) => {
        const v = await mount()
        const id = await start(v)
        await poll(v, overview('checking'), 'interval')
        const pending = v.deferNextResume()
        const result = v.sdk.refresh(id).then(
            (value) => ({ value }),
            (error) => ({ error })
        )
        await v.settle()
        await invalidate(v, change)
        expect(active(v)).toEqual([])
        await pending.reply(200, { token: 'stale-refresh' })
        expect(await result).not.toEqual({ value: 'stale-refresh' })
        await v.settle()
        expect(active(v)).toEqual([])
        expect(v.sdk.sessions).toHaveLength(1)
    })
})

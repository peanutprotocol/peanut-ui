/** Frozen independent UI assertions. This file requires the real-render adapter described alongside it. */
import { afterEach, describe, expect, test } from '@jest/globals'
import { isInaccessible, within } from '@testing-library/dom'
import { mountCardContinuation } from './addon-ui-real-render-adapter'
import type { AuthFixture, CardOverviewFixture, MountedCardContinuation } from './adapter-contract'
import { issuedCardOverview, USER, GENERATION, SCOPE } from './fixtures'
const TOKEN = 'synthetic-start-token'
const REFRESH_TOKEN = 'synthetic-refresh-token'
let view: MountedCardContinuation | undefined
async function mount(session: AuthFixture = { userId: USER }, overview: CardOverviewFixture = issuedCardOverview()) {
    view = await mountCardContinuation({ session, overview })
    await view.settle()
    return view
}
function cta(view: MountedCardContinuation) {
    return within(view.root).queryByText(/^complete verification$/i)
}
function activeSessions(view: MountedCardContinuation) {
    return view.sdk.sessions.filter((session) => session.mounted)
}
function resumes(view: MountedCardContinuation) {
    return view.requests.filter((request) => request.kind === 'resume')
}
function count(view: MountedCardContinuation, kind: 'overview' | 'profile') {
    return view.requests.filter((request) => request.kind === kind).length
}
function cardPresent(view: MountedCardContinuation) {
    expect(
        within(view.root)
            .queryAllByText(/1234/)
            .filter((element) => !isInaccessible(element)).length
    ).toBeGreaterThan(0)
}
function exactResume(
    view: MountedCardContinuation,
    index: number,
    user = USER,
    generation = GENERATION,
    scope = SCOPE
) {
    const request = resumes(view)[index]
    expect(request).toBeDefined()
    expect(request).toMatchObject({ method: 'POST', path: '/rain/verification/resume', body: { generation } })
    expect(Object.keys(request.body as object)).toEqual(['generation'])
    expect(request.headers['x-kyc-entry-user']).toBe(user)
    expect(request.headers['x-kyc-entry-scope']).toBe(scope)
    expect(typeof request.signalSupplied).toBe('boolean')
    expect(typeof request.aborted).toBe('boolean')
}
async function start(view: MountedCardContinuation) {
    const pending = view.deferNextResume()
    const button = cta(view)
    expect(button).not.toBeNull()
    await view.tap(button!)
    await view.settle()
    await pending.reply(200, { token: TOKEN })
    await view.settle()
    const session = activeSessions(view).find((value) => value.token === TOKEN)
    expect(session).toBeDefined()
    return session!.id
}
afterEach(async () => {
    if (view) {
        try {
            expect(view.forbiddenCalls).toEqual([])
            expect(
                view.requests.filter((request) => ['apply', 'create-card', 'issuance'].includes(request.kind))
            ).toEqual([])
        } finally {
            await view.dispose()
            view = undefined
        }
    }
})

describe('issued-card continuation uses the real card surface and callbacks', () => {
    test('active card remains visible, with a continuation CTA and no render-triggered resume', async () => {
        const mounted = await mount()
        cardPresent(mounted)
        expect(cta(mounted)).not.toBeNull()
        expect(resumes(mounted)).toEqual([])
        expect(mounted.sdk.sessions).toEqual([])
    })
    test('existing issued-card management remains usable without starting verification', async () => {
        const mounted = await mount()
        cardPresent(mounted)
        const control = mounted.existingCardControl()
        expect(document.contains(control)).toBe(true)
        expect(control.getAttribute('aria-disabled')).not.toBe('true')
        expect((control as HTMLButtonElement).disabled).not.toBe(true)
        await mounted.tap(control)
        await mounted.settle()
        const management = mounted.existingCardManagementView()
        expect(management).not.toBeNull()
        expect(document.contains(management)).toBe(true)
        expect(resumes(mounted)).toEqual([])
        expect(mounted.sdk.sessions).toEqual([])
    })
    test('older overview with no action preserves active card and has no continuation CTA', async () => {
        const overview = issuedCardOverview()
        delete overview.pendingVerification
        const mounted = await mount({ userId: USER }, overview)
        cardPresent(mounted)
        expect(cta(mounted)).toBeNull()
        expect(resumes(mounted)).toEqual([])
        expect(mounted.sdk.sessions).toEqual([])
    })
    test.each([null, { userId: null }])('signed-out or missing account %j cannot start a task', async (session) => {
        const mounted = await mount(session)
        expect(cta(mounted)).toBeNull()
        expect(resumes(mounted)).toEqual([])
        expect(mounted.sdk.sessions).toEqual([])
    })
    test('only a real tap sends the captured generation and comparison headers; SDK receives its token', async () => {
        const mounted = await mount()
        await start(mounted)
        expect(resumes(mounted)).toHaveLength(1)
        exactResume(mounted, 0)
        expect(activeSessions(mounted)).toHaveLength(1)
        expect(activeSessions(mounted)[0].token).toBe(TOKEN)
    })
    test('duplicate taps while start is in flight cannot create duplicate sessions or mint requests', async () => {
        const mounted = await mount()
        const pending = mounted.deferNextResume()
        const button = cta(mounted)!
        await mounted.tap(button)
        await mounted.tap(button)
        await mounted.settle()
        expect(resumes(mounted)).toHaveLength(1)
        expect(mounted.sdk.sessions).toEqual([])
        exactResume(mounted, 0)
        await pending.reply(200, { token: TOKEN })
        await mounted.settle()
        expect(activeSessions(mounted)).toHaveLength(1)
    })
    test('SDK refresh uses the same captured owner, scope and generation', async () => {
        const mounted = await mount()
        const id = await start(mounted)
        const pending = mounted.deferNextResume()
        const refreshed = mounted.sdk.refresh(id)
        await mounted.settle()
        expect(resumes(mounted)).toHaveLength(2)
        exactResume(mounted, 1)
        await pending.reply(200, { token: REFRESH_TOKEN })
        expect(await refreshed).toBe(REFRESH_TOKEN)
        await mounted.settle()
        expect(activeSessions(mounted)).toHaveLength(1)
    })
    test.each(['complete', 'close'] as const)(
        'SDK %s clears its session and refetches overview plus profile without issuance',
        async (event) => {
            const mounted = await mount()
            const id = await start(mounted)
            const overviewBefore = count(mounted, 'overview')
            const profileBefore = count(mounted, 'profile')
            await mounted.sdk[event](id)
            await mounted.settle()
            expect(activeSessions(mounted)).toEqual([])
            expect(count(mounted, 'overview')).toBeGreaterThan(overviewBefore)
            expect(count(mounted, 'profile')).toBeGreaterThan(profileBefore)
            cardPresent(mounted)
            expect(resumes(mounted)).toHaveLength(1)
        }
    )
    test.each([
        [404, {}],
        [409, { code: 'verification_task_changed' }],
        [503, { code: 'verification_task_unavailable' }],
        [400, { error: 'Malformed input' }],
    ] as Array<[number, unknown]>)(
        'HTTP %i leaves issued-card management intact and opens no SDK',
        async (status, body) => {
            const mounted = await mount()
            const pending = mounted.deferNextResume()
            await mounted.tap(cta(mounted)!)
            await mounted.settle()
            await pending.reply(status, body)
            await mounted.settle()
            cardPresent(mounted)
            expect(mounted.sdk.sessions).toEqual([])
            expect(resumes(mounted)).toHaveLength(1)
            const control = mounted.existingCardControl()
            expect((control as HTMLButtonElement).disabled).not.toBe(true)
        }
    )
    test('network failure preserves the issued card and permits a later explicit retry', async () => {
        const mounted = await mount()
        const pending = mounted.deferNextResume()
        await mounted.tap(cta(mounted)!)
        await mounted.settle()
        await pending.reject(new Error('synthetic network unavailable'))
        await mounted.settle()
        cardPresent(mounted)
        expect(mounted.sdk.sessions).toEqual([])
        await start(mounted)
        expect(resumes(mounted)).toHaveLength(2)
        exactResume(mounted, 1)
    })
    test.each([{}, null, { token: '' }, { token: ' ' }, { token: null }, { token: 4 }, { token: {} }])(
        'invalid successful token body %j never opens SDK',
        async (body) => {
            const mounted = await mount()
            const pending = mounted.deferNextResume()
            await mounted.tap(cta(mounted)!)
            await mounted.settle()
            await pending.reply(200, body)
            await mounted.settle()
            cardPresent(mounted)
            expect(mounted.sdk.sessions).toEqual([])
        }
    )
    test.each([
        [404, {}],
        [409, { code: 'verification_task_changed' }],
        [503, { code: 'verification_task_unavailable' }],
        [200, { token: '' }],
        [200, {}],
    ] as Array<[number, unknown]>)(
        'refresh failure %i cannot supply a token or create another SDK session',
        async (status, body) => {
            const mounted = await mount()
            const id = await start(mounted)
            const pending = mounted.deferNextResume()
            const outcome = mounted.sdk.refresh(id).then(
                (value) => ({ value }),
                (error) => ({ error })
            )
            await mounted.settle()
            exactResume(mounted, 1)
            await pending.reply(status, body)
            const result = await outcome
            await mounted.settle()
            if ('value' in result)
                expect(typeof result.value === 'string' && result.value.trim().length > 0).toBe(false)
            expect(mounted.sdk.sessions).toHaveLength(1)
            expect(activeSessions(mounted).length).toBeLessThanOrEqual(1)
        }
    )
})

type Change = 'account' | 'sign-out' | 'generation' | 'scope' | 'action-removed' | 'route'
const changes: Change[] = ['account', 'sign-out', 'generation', 'scope', 'action-removed', 'route']
async function invalidate(mounted: MountedCardContinuation, change: Change) {
    if (change === 'account') {
        await mounted.setSession({ userId: 'user-b' })
        const overview = issuedCardOverview()
        delete overview.pendingVerification
        overview.cards[0] = { ...overview.cards[0], id: 'card-b', rainCardId: 'rain-b', last4: '5678' }
        await mounted.publishOverview(overview)
    } else if (change === 'sign-out') await mounted.setSession(null)
    else if (change === 'route') await mounted.navigateAway()
    else {
        const overview = issuedCardOverview()
        if (change === 'generation') overview.pendingVerification!.generation = 'generation-b'
        if (change === 'scope') overview.pendingVerification!.entryScope = 'b'.repeat(64)
        if (change === 'action-removed') {
            delete overview.pendingVerification
            overview.verificationContext = { status: 'none' }
        }
        await mounted.publishOverview(overview)
    }
    await mounted.settle()
}
describe('late start and refresh results cannot escape their captured session', () => {
    test.each(changes)('%s change ignores a delayed initial token', async (change) => {
        const mounted = await mount()
        const pending = mounted.deferNextResume()
        await mounted.tap(cta(mounted)!)
        await mounted.settle()
        exactResume(mounted, 0)
        await invalidate(mounted, change)
        await pending.reply(200, { token: 'synthetic-stale-start-token' })
        await mounted.settle()
        expect(activeSessions(mounted)).toEqual([])
        expect(mounted.sdk.sessions).toEqual([])
        expect(resumes(mounted)).toHaveLength(1)
        expect(typeof resumes(mounted)[0].aborted).toBe('boolean')
    })
    test.each(changes)('%s change discards delayed refresh and does not reopen the SDK', async (change) => {
        const mounted = await mount()
        const id = await start(mounted)
        const pending = mounted.deferNextResume()
        const outcome = mounted.sdk.refresh(id).then(
            (value) => ({ value }),
            (error) => ({ error })
        )
        await mounted.settle()
        exactResume(mounted, 1)
        await invalidate(mounted, change)
        expect(activeSessions(mounted)).toEqual([])
        await pending.reply(200, { token: 'synthetic-stale-refresh-token' })
        const result = await outcome
        await mounted.settle()
        expect(result).not.toEqual({ value: 'synthetic-stale-refresh-token' })
        expect(activeSessions(mounted)).toEqual([])
        expect(mounted.sdk.sessions).toHaveLength(1)
        expect(resumes(mounted)).toHaveLength(2)
    })
    test('a new genuine generation requires its own tap and captured request after an older start is discarded', async () => {
        const mounted = await mount()
        const pending = mounted.deferNextResume()
        await mounted.tap(cta(mounted)!)
        await mounted.settle()
        const next = issuedCardOverview()
        next.pendingVerification = { kind: 'card_addon', generation: 'generation-b', entryScope: 'b'.repeat(64) }
        await mounted.publishOverview(next)
        await mounted.settle()
        await pending.reply(200, { token: 'synthetic-old-token' })
        await mounted.settle()
        expect(mounted.sdk.sessions).toEqual([])
        expect(resumes(mounted)).toHaveLength(1)
        await start(mounted)
        expect(resumes(mounted)).toHaveLength(2)
        exactResume(mounted, 1, USER, 'generation-b', 'b'.repeat(64))
    })
})

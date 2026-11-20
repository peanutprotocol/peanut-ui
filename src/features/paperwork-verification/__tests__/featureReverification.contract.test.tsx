import { act, screen, waitFor } from '@testing-library/react'
import type { FeatureReverificationEntry as Entry } from '@/app/actions/types/kyc-reverification.types'
import type { paths } from '@/types/api.generated'

// The adapter renders the public routes with a scripted HTTP transport and router.
// Observations must come from rendered controls, navigation and captured requests.
type Feature = Entry['feature']
type Provider = Entry['targetProvider']
type StartResponses = paths['/users/kyc/reverification']['post']['responses']
type StartConflict = StartResponses[409]['content']['application/json']

type Fixture = {
    feature: Feature
    destination: string
    canonicalStatus: 'APPROVED'
    invitation: Entry | { status: 409; code: 'feature_reverification_required' }
    startResponse?: Entry
}

type Driver = {
    invitationUrl(): string
    openInvitation(): Promise<void>
    doubleTapStart(): Promise<void>
    rejectPendingStartAsTimeout(): Promise<void>
    retryStart(): Promise<void>
    resolvePendingStart(): Promise<void>
    postRequests(): { path: string; body: Record<string, unknown> }[]
    currentCandidate(): { feature: Feature; targetProvider: Provider; attemptId: string } | null
    currentPath(): string
    reload(): Promise<void>
    switchAccount(): Promise<void>
    reads(): string[]
    reserveUnprepared(): void
    finishPreparation(): Promise<void>
    setNoEntry(state: 'on' | 'refused' | 'pending' | 'ready'): void
    setResidenceUnsupported(): void
    resolveStartError(status: number, body: unknown, retryAfter?: string): Promise<void>
    resolveTerminal(status: 'APPROVED' | 'REJECTED' | 'SUPERSEDED'): Promise<void>
    relaunchNative(): Promise<void>
    dispose(): void
}

// Implement the adapter alongside this file. Seed backend responses only;
// production code owns the invitation, request key, and candidate selection.
const { mountFeatureGate } = require('./featureReverification.test-adapter') as {
    mountFeatureGate(fixture: Fixture): Promise<Driver>
}

const card: Entry = { kind: 'reverify_for_feature', feature: 'card', targetProvider: 'RAIN', attemptId: null }
const active: Entry = {
    kind: 'reverify_for_feature',
    feature: 'bank',
    targetProvider: 'BRIDGE',
    attemptId: 'attempt-b',
}
const destination = '/card?tab=details'
const fixture: Fixture = {
    feature: 'card',
    canonicalStatus: 'APPROVED',
    destination,
    invitation: card,
    startResponse: active,
}
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
let driver: Driver | undefined
afterEach(() => {
    driver?.dispose()
    driver = undefined
    jest.useRealTimers()
})

it.each<Fixture['invitation']>([card, { status: 409, code: 'feature_reverification_required' }])(
    'opens the invitation from %j without creating an attempt',
    async (invitation) => {
        driver = await mountFeatureGate({ ...fixture, invitation })
        const url = new URL(driver.invitationUrl(), 'https://peanut.test')
        expect(url.origin).toBe('https://peanut.test')
        expect(url.pathname).toBe('/verify')
        expect(url.searchParams.get('mode')).toBe('reverify')
        expect(url.searchParams.get('feature')).toBe('card')
        expect(url.searchParams.get('returnTo')).toBe(destination)
        expect(driver.postRequests()).toEqual([])
        await driver.openInvitation()
        await driver.reload()
        expect(driver.postRequests()).toEqual([])
    }
)

it('reuses one key across double taps and an uncertain retry, then follows the returned candidate', async () => {
    driver = await mountFeatureGate(fixture)
    await driver.openInvitation()
    await driver.doubleTapStart()
    const requests = driver.postRequests()
    expect(requests).toHaveLength(1)
    expect(requests[0]).toEqual({
        path: '/users/kyc/reverification',
        body: { feature: 'card', requestKey: expect.stringMatching(uuid) },
    })
    await driver.rejectPendingStartAsTimeout()
    await driver.retryStart()
    expect(driver.postRequests()).toEqual([requests[0], requests[0]])
    await driver.resolvePendingStart()
    const expected = { feature: 'bank', targetProvider: 'BRIDGE', attemptId: 'attempt-b' }
    expect(driver.currentCandidate()).toEqual(expected)
    await driver.reload()
    expect(driver.currentCandidate()).toEqual(expected)
    expect(driver.currentPath()).not.toBe(destination)
    expect(driver.postRequests()).toHaveLength(2)
})

it('stops re-verification when the residence becomes unsupported', async () => {
    driver = await mountFeatureGate(fixture)
    await driver.openInvitation()
    await driver.doubleTapStart()
    await driver.resolvePendingStart()
    expect(driver.currentCandidate()).toEqual(expect.objectContaining({ attemptId: active.attemptId }))

    driver.setResidenceUnsupported()
    await driver.reload()

    expect(await screen.findByRole('heading', { name: 'residenceNotSupported' })).toBeVisible()
    expect(driver.currentCandidate()).toBeNull()
    expect(screen.queryByTestId('verify-reverification-start')).not.toBeInTheDocument()
    expect(driver.postRequests()).toHaveLength(1)
})

it('discards a start response delivered after the account changes', async () => {
    driver = await mountFeatureGate(fixture)
    await driver.openInvitation()
    await driver.doubleTapStart()
    await driver.switchAccount()
    await driver.resolvePendingStart()
    expect(driver.currentCandidate()).toBeNull()
    expect(driver.postRequests()).toHaveLength(1)
})

it('requires an explicit Continue after an interrupted preparation and reuses the saved key', async () => {
    driver = await mountFeatureGate(fixture)
    await driver.openInvitation()
    await driver.doubleTapStart()
    driver.reserveUnprepared()
    await driver.rejectPendingStartAsTimeout()
    await driver.reload()
    expect(driver.currentCandidate()).toBeNull()
    expect(driver.postRequests()).toHaveLength(1)
    expect(screen.getByTestId('verify-reverification-start')).toHaveTextContent('continue')
    await driver.retryStart()
    expect(driver.postRequests()).toEqual([driver.postRequests()[0], driver.postRequests()[0]])
    await driver.finishPreparation()
    expect(driver.currentCandidate()).toEqual({
        feature: 'card',
        targetProvider: 'RAIN',
        attemptId: 'reserved-candidate',
    })
    expect(
        sessionStorage.getItem('kyc:feature-reverification:' + JSON.stringify(['contract-user-a', 'card']))
    ).toBeNull()
})

it.each([
    ['on', null],
    ['ready', null],
    ['refused', 'reverify.refusalCard'],
    ['pending', 'reverify.pendingTitle'],
] as const)('resolves a storage-free native relaunch from the live %s feature state', async (state, copy) => {
    driver = await mountFeatureGate(fixture)
    driver.setNoEntry(state)
    await driver.relaunchNative()
    if (copy) expect(await screen.findByText(copy)).toBeInTheDocument()
    else expect(driver.currentPath()).toBe(destination)
    expect(driver.reads()).toEqual(expect.arrayContaining(['/users/kyc/plan?feature=card', '/users/kyc/features']))
    expect(screen.queryByText('plan-load-failed')).not.toBeInTheDocument()
    expect(driver.postRequests()).toEqual([])
})

it.each(['reverification_not_required', 'reverification_finished'] as const)(
    'refreshes %s and returns when the feature is open',
    async (code) => {
        driver = await mountFeatureGate(fixture)
        await driver.openInvitation()
        await driver.doubleTapStart()
        driver.setNoEntry('on')
        const copy = 'Already set up'
        const display = { userMessage: copy, message: copy, error: copy }
        const conflict: StartConflict =
            code === 'reverification_finished' ? { code, outcome: 'APPROVED', ...display } : { code, ...display }
        await driver.resolveStartError(409, conflict)
        await waitFor(() => expect(driver?.currentPath()).toBe(destination))
        expect(driver.reads()).toContain('/users/kyc/features')
        expect(driver.postRequests()).toHaveLength(1)
    }
)

it.each([
    [409, 'feature_not_open', 'reverify.refusalCard'],
    [409, 'reverification_finished', 'reverify.refusalCard'],
    [409, 'kyc_client_update_required', 'Update required'],
    [403, 'forbidden', 'This account cannot start'],
] as const)('handles %s %s without offering to replay the rejected start', async (status, code, copy) => {
    driver = await mountFeatureGate(fixture)
    await driver.openInvitation()
    await driver.doubleTapStart()
    const display = { userMessage: copy, message: copy, error: copy }
    const body: StartConflict | StartResponses[403]['content']['application/json'] =
        code === 'reverification_finished' ? { code, outcome: 'REJECTED', ...display } : { code, ...display }
    await driver.resolveStartError(status, body)
    expect(await screen.findByText(copy)).toBeInTheDocument()
    expect(screen.queryByTestId('verify-reverification-start')).not.toBeInTheDocument()
    expect(driver.postRequests()).toHaveLength(1)
    expect(
        sessionStorage.getItem('kyc:feature-reverification:' + JSON.stringify(['contract-user-a', 'card']))
    ).toBeNull()
})

it('drops the key for a terminal success response without opening the candidate', async () => {
    driver = await mountFeatureGate(fixture)
    await driver.openInvitation()
    await driver.doubleTapStart()
    await driver.resolveTerminal('APPROVED')
    expect(driver.currentPath()).toBe(destination)
    expect(driver.currentCandidate()).toBeNull()
    expect(
        sessionStorage.getItem('kyc:feature-reverification:' + JSON.stringify(['contract-user-a', 'card']))
    ).toBeNull()
})

it.each(['seconds', 'HTTP date'])(
    'honours Retry-After in %s and resumes with the same key only after another tap',
    async (format) => {
        driver = await mountFeatureGate(fixture)
        await driver.openInvitation()
        jest.useFakeTimers()
        jest.setSystemTime(new Date('2026-11-19T10:00:00Z'))
        await driver.doubleTapStart()
        const retryAfter = format === 'seconds' ? '3' : 'Thu, 19 Nov 2026 10:00:03 GMT'
        const copy = 'Temporarily unavailable'
        await driver.resolveStartError(
            503,
            {
                code: 'feature_setup_unavailable',
                userMessage: copy,
                message: copy,
                error: copy,
            } satisfies StartResponses[503]['content']['application/json'],
            retryAfter
        )
        const retry = screen.getByTestId('verify-reverification-start')
        expect(screen.getByRole('alert')).toHaveTextContent('Temporarily unavailable')
        expect(retry).toBeDisabled()
        await driver.retryStart()
        expect(driver.postRequests()).toHaveLength(1)
        await act(async () => jest.advanceTimersByTimeAsync(2_999))
        expect(retry).toBeDisabled()
        await act(async () => jest.advanceTimersByTimeAsync(1))
        expect(retry).toBeEnabled()
        expect(driver.postRequests()).toHaveLength(1)
        await driver.retryStart()
        expect(driver.postRequests()).toEqual([driver.postRequests()[0], driver.postRequests()[0]])
    }
)

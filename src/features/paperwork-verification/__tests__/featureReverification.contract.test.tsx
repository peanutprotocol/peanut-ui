// The adapter renders the public routes with a scripted HTTP transport and router.
// Observations must come from rendered controls, navigation and captured requests.
type Feature = 'card' | 'bank' | 'local'
type Provider = 'RAIN' | 'BRIDGE' | 'MANTECA' | 'AVENIA'
type Entry = {
    kind: 'reverify_for_feature'
    feature: Feature
    targetProvider: Provider
    attemptId: string | null
}

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

it('discards a start response delivered after the account changes', async () => {
    driver = await mountFeatureGate(fixture)
    await driver.openInvitation()
    await driver.doubleTapStart()
    await driver.switchAccount()
    await driver.resolvePendingStart()
    expect(driver.currentCandidate()).toBeNull()
    expect(driver.postRequests()).toHaveLength(1)
})

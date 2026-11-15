import { run } from '@/features/attention/__tests__/legacy-manager.fixture'

// The old Home modal chain was replaced by Attention. Keep each collision
// scenario against the actual manager and its accepted catalogue ordering.
const balance = { loaded: true, usd: 1000 }
const arrival = { arrival: 'raised', balance } as const

test('arrival is shown while the balance warning waits', () => {
    const result = run(arrival)
    expect(result.interrupt).toBe('arrival')
    expect(result.trace.reasons['balance-backup']).toBe('an interrupt is open')
})
test('the balance warning opens once there is no arrival', () => {
    expect(run({ arrival: 'none', balance }).interrupt).toBe('balance-backup')
})
test('an unknown arrival holds the balance warning until the settling deadline', () => {
    expect(run({ arrival: 'unknown', balance }).interrupt).toBeNull()
    expect(run({ arrival: 'unknown', balance }, { settleDeadlinePassed: true }).interrupt).toBe('balance-backup')
})
test('the balance warning never opens over the QR scanner', () => {
    expect(run({ arrival: 'none', balance }, { busy: true }).interrupt).toBeNull()
})
test('an early-user announcement not yet opened does not outrank arrival', () => {
    expect(run({ ...arrival, showEarlyUserModal: true }).interrupt).toBe('arrival')
})
test('an early-user flag whose drawer is closed does not hide arrival', () => {
    expect(run({ ...arrival, showEarlyUserModal: true }).interrupt).toBe('arrival')
})
test('an already-open early-user drawer stays the interrupt until it closes', () => {
    expect(run({ ...arrival, showEarlyUserModal: true }, { openInterrupt: 'early-user' }).interrupt).toBe('early-user')
})
test('arrival waits while a user-opened push prompt is up', () => {
    expect(run(arrival, { busy: true }).interrupt).toBeNull()
})
test('the higher-ranked migration prompt comes before arrival', () => {
    expect(run({ ...arrival, isNative: false, migration: { on: true } }).interrupt).toBe('install-app')
})
test('an already-open post-signup prompt stays until it closes', () => {
    expect(
        run(
            {
                ...arrival,
                postAuthRedirect: true,
                identity: {
                    status: 'verified',
                    isVerified: true,
                    needsAction: false,
                    isTerminalFailure: false,
                    isRegionRestricted: false,
                },
            },
            { openInterrupt: 'post-verification-action' }
        ).interrupt
    ).toBe('post-verification-action')
})

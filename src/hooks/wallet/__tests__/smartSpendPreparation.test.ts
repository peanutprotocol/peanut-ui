/**
 * preparedSmartSpendStaleness — the one predicate that decides whether a
 * pre-Pay candidate may still be signed. Nonce and sponsorship freshness are
 * RPC reads and are covered in useSignUserOp.test.tsx; this is the static part.
 */
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
}))

import { buildUsdcTransferCall, preparedSmartSpendStaleness, type PreparedSmartSpend } from '../smartSpendPreparation'

const RECIPIENT = '0x4e5b89fd498f333ed7f2a59c5f23d5b5dc41b3de'
const OTHER = '0x1111111111111111111111111111111111111111'
const client = { tag: 'client' }
const NOW = 1_000_000

function candidate(overrides: Partial<PreparedSmartSpend> = {}): PreparedSmartSpend {
    return {
        client,
        chainId: '42161',
        entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
        accountAddress: '0xc97fffbf8768ca90cd62fae2e313b084fe13e553',
        calls: [buildUsdcTransferCall(RECIPIENT, 10_000_000n)],
        lockCode: 'LOCK123',
        lockExpiresAtMs: NOW + 60_000,
        userOperation: { nonce: 7n } as PreparedSmartSpend['userOperation'],
        ...overrides,
    }
}

const live = (overrides: Partial<Parameters<typeof preparedSmartSpendStaleness>[1]> = {}) => ({
    client,
    chainId: '42161',
    calls: [buildUsdcTransferCall(RECIPIENT, 10_000_000n)],
    now: NOW,
    ...overrides,
})

test('a candidate for the same client, chain, calls and a live lock is usable', () => {
    expect(preparedSmartSpendStaleness(candidate(), live())).toBeNull()
})

test('a rebuilt kernel client (migration, re-login) is a different signer', () => {
    expect(preparedSmartSpendStaleness(candidate(), live({ client: { tag: 'rebuilt' } }))).toBe('client')
})

test('a different chain is stale', () => {
    expect(preparedSmartSpendStaleness(candidate(), live({ chainId: '421614' }))).toBe('chain')
})

test.each([
    ['amount', [buildUsdcTransferCall(RECIPIENT, 10_000_001n)]],
    ['recipient', [buildUsdcTransferCall(OTHER, 10_000_000n)]],
    ['call count', [buildUsdcTransferCall(RECIPIENT, 10_000_000n), buildUsdcTransferCall(RECIPIENT, 1n)]],
])('a changed %s is stale', (_label, calls) => {
    expect(preparedSmartSpendStaleness(candidate(), live({ calls }))).toBe('calls')
})

test('address case does not make an identical call look different', () => {
    const upper = buildUsdcTransferCall(RECIPIENT, 10_000_000n)
    upper.to = upper.to.toUpperCase().replace('0X', '0x') as typeof upper.to
    expect(preparedSmartSpendStaleness(candidate(), live({ calls: [upper] }))).toBeNull()
})

test('the lock expiry is honored, boundary included', () => {
    expect(preparedSmartSpendStaleness(candidate(), live({ now: NOW + 60_000 }))).toBe('expired')
    expect(preparedSmartSpendStaleness(candidate(), live({ now: NOW + 59_999 }))).toBeNull()
})

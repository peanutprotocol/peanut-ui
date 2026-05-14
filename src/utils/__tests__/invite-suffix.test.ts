import { generateInviteCodeSuffix } from '../general.utils'

// Parity vectors — MUST match the peanut-api-ts copy of generateInviteCodeSuffix
// (src/utils/invite.ts::generateInviteCodeSuffix). If you change the hash
// algorithm here, update the BE copy AND the matching test file:
//   peanut-api-ts/src/utils/invite.test.ts
//
// Why duplicate? The function is 6 lines of pure math called on every render
// in 5 places. A server round-trip would cost more than a drift bug. These
// vectors catch drift in CI.
const PARITY_VECTORS: Array<[string, string]> = [
    ['alice', '610'],
    ['bob', '407'],
    ['devtest', '867'],
    ['hugo', '535'],
    ['PEANUT', '753'],
    ['a', '197'],
    ['z', '222'],
    ['', '100'],
]

describe('generateInviteCodeSuffix (FE/BE parity)', () => {
    test.each(PARITY_VECTORS)('suffix(%s) = %s', (username, expected) => {
        expect(generateInviteCodeSuffix(username)).toBe(expected)
    })

    test('is case-insensitive', () => {
        expect(generateInviteCodeSuffix('Alice')).toBe(generateInviteCodeSuffix('alice'))
    })

    test('three digits in [100, 999]', () => {
        for (const s of ['a', 'ab', 'abc', 'aaaaaaa']) {
            const out = Number(generateInviteCodeSuffix(s))
            expect(out).toBeGreaterThanOrEqual(100)
            expect(out).toBeLessThanOrEqual(999)
        }
    })
})

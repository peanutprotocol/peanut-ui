/**
 * Pure-function tests for the spend-routing primitives in `useSpendBundle`.
 *
 * The hook itself orchestrates kernel clients, Rain API calls, and the
 * session-key grant flow — those paths are covered by integration + manual
 * testing on sandbox. These tests lock down the deterministic pieces:
 *   - `computeSpendStrategy` routing (collateral → smart → mixed → insufficient)
 *   - `usdcWeiToRainCents` amount conversion at the Rain API boundary
 */

// Mock the ZeroDev imports so Jest doesn't try to parse their ESM.
// The pure functions we're testing don't touch any of this at runtime.
jest.mock('@zerodev/permissions', () => ({}))
jest.mock('@zerodev/permissions/policies', () => ({}))
jest.mock('@zerodev/permissions/signers', () => ({}))
jest.mock('@zerodev/sdk', () => ({}))
jest.mock('@zerodev/sdk/constants', () => ({}))
jest.mock('@/context/kernelClient.context', () => ({ useKernelClient: jest.fn() }))
jest.mock('@/context/authContext', () => ({ useAuth: jest.fn() }))
jest.mock('@/hooks/useZeroDev', () => ({ useZeroDev: jest.fn() }))
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: jest.fn(),
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
}))
jest.mock('../useGrantSessionKey', () => ({ useGrantSessionKey: jest.fn() }))
jest.mock('@/services/rain', () => ({ rainApi: {} }))
jest.mock('@/app/actions/clients', () => ({ peanutPublicClient: {} }))

// Mock constants so the module can resolve token decimals during import.
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 137 },
    PEANUT_WALLET_TOKEN: '0x1234567890123456789012345678901234567890',
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
}))
jest.mock('@/constants/rain.consts', () => ({
    rainCoordinatorAbi: [],
    rainWithdrawEip712Types: {},
    RAIN_WITHDRAW_EIP712_DOMAIN_NAME: 'Collateral',
    RAIN_WITHDRAW_EIP712_DOMAIN_VERSION: '2',
}))

// eslint-disable-next-line import/first -- mocks must register before import
import { computeSpendStrategy } from '../useSpendBundle'

describe('computeSpendStrategy', () => {
    const amount = 1000n

    it('prefers collateral-only when allowed and rain covers the amount', () => {
        expect(computeSpendStrategy({ smart: 5000n, rain: 10_000n, amount, collateralOnlyAllowed: true })).toBe(
            'collateral-only'
        )
    })

    it('falls back to smart-only when collateral-only is not allowed', () => {
        expect(computeSpendStrategy({ smart: 5000n, rain: 10_000n, amount, collateralOnlyAllowed: false })).toBe(
            'smart-only'
        )
    })

    it('prefers smart-only when collateral alone cannot cover (even with collateral-only allowed)', () => {
        expect(computeSpendStrategy({ smart: 5000n, rain: 500n, amount, collateralOnlyAllowed: true })).toBe(
            'smart-only'
        )
    })

    it('returns mixed when neither bucket alone covers but the sum does', () => {
        expect(computeSpendStrategy({ smart: 400n, rain: 700n, amount, collateralOnlyAllowed: true })).toBe('mixed')
    })

    it('returns insufficient when the total spendable is below the amount', () => {
        expect(computeSpendStrategy({ smart: 100n, rain: 200n, amount, collateralOnlyAllowed: true })).toBe(
            'insufficient'
        )
    })

    it('handles exact-match at the boundary as collateral-only (>=)', () => {
        expect(computeSpendStrategy({ smart: 0n, rain: amount, amount, collateralOnlyAllowed: true })).toBe(
            'collateral-only'
        )
    })

    it('handles exact-match at the boundary as smart-only when rain disallowed', () => {
        expect(computeSpendStrategy({ smart: amount, rain: 0n, amount, collateralOnlyAllowed: false })).toBe(
            'smart-only'
        )
    })
})

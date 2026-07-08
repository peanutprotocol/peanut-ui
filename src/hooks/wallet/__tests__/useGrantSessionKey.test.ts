/**
 * Tests for useGrantSessionKey — the Rain card session-key grant.
 *
 * Money-path invariant under test: the serialized permission approval this hook
 * produces (which the backend replays for auto-balance sweeps and collateral
 * withdrawals) MUST bind its sudo plugin to the v0.0.3 PATCHED passkey
 * validator (`0x7ab1…`), for EVERY user — including pre-2025-09-18 accounts
 * whose migration kernel client still exposes the STALE v0.0.2 validator
 * (`0xbA45…`) via `account.kernelPluginManager.sudoValidator`.
 *
 * Binding to v0.0.2 makes ZeroDev's paymaster reject ("Unauthorized: wapk",
 * HTTP 403) every backend-replayed userOp — the confirmed prod bug (itueze73).
 * The regression guard: for a migration user whose client exposes v0.0.2, the
 * serialized approval must STILL embed v0.0.3. The buggy code (reading the
 * client's `sudoValidator`) would embed v0.0.2 here and fail this test.
 */

import { renderHook, act } from '@testing-library/react'

const V002_VALIDATOR = '0xbA45a2BFb8De3D24cA9D7F1B551E14dFF5d690Fd'
const V003_VALIDATOR = '0x7ab16Ff354AcB328452F1D445b3Ddee9a91e9e69'
const USER_ADDRESS = '0x00000000000000000000000000000000000000aa'
const COLLATERAL_PROXY = '0x00000000000000000000000000000000000000bb'
const COORDINATOR = '0x00000000000000000000000000000000000000cc'
const SESSION_KEY = '0x00000000000000000000000000000000000000dd'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: '0x1111111111111111111111111111111111111111',
}))

jest.mock('@/constants/rain.consts', () => ({
    rainCoordinatorAbi: [
        {
            type: 'function',
            name: 'withdrawAsset',
            inputs: [{ type: 'address' }, { type: 'uint256' }],
            outputs: [],
            stateMutability: 'nonpayable',
        },
    ],
}))

// The enable-nonce-binding path (hotfix #2313) reads code + currentNonce off
// the public client alongside account construction.
jest.mock('@/app/actions/clients', () => ({
    peanutPublicClient: {
        __tag: 'peanutPublicClient',
        getCode: jest.fn(() => Promise.resolve('0xdeadbeef')),
        readContract: jest.fn(() => Promise.resolve(BigInt(1))),
    },
}))

const mockGetSessionKeyAddress = jest.fn()
const mockSubmitWithdrawSessionApproval = jest.fn()
jest.mock('@/services/rain', () => ({
    rainApi: {
        getSessionKeyAddress: (...args: unknown[]) => mockGetSessionKeyAddress(...args),
        submitWithdrawSessionApproval: (...args: unknown[]) => mockSubmitWithdrawSessionApproval(...args),
    },
}))

let mockOverview: unknown
const mockRefetch = jest.fn()
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({ overview: mockOverview, refetch: mockRefetch }),
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
}))

jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}))

// @zerodev/permissions leaves — serialize encodes the sudo validator address the
// session account was built with, exactly as the real serializer would.
jest.mock('@zerodev/permissions', () => ({
    toPermissionValidator: jest.fn(() => Promise.resolve({ address: '0xperm' })),
    serializePermissionAccount: jest.fn((account: { __sudoValidator: { address: string } }) =>
        Promise.resolve(`permission:sudo=${account.__sudoValidator.address}`)
    ),
}))
jest.mock('@zerodev/permissions/policies', () => ({
    toCallPolicy: jest.fn(() => Promise.resolve({ policy: 'call' })),
    CallPolicyVersion: { V0_0_4: 'V0_0_4' },
    ParamCondition: { EQUAL: 0 },
}))
jest.mock('@zerodev/permissions/signers', () => ({
    toECDSASigner: jest.fn(() => Promise.resolve({ address: '0xsigner' })),
}))

// The kernel client's exposed sudoValidator — v0.0.2 for a migration user,
// v0.0.3 for a post-migration user. `getPatchedSudoValidator` is the FIX: it
// always resolves the v0.0.3 validator regardless of the client's stale one.
let mockClientSudoValidatorAddress = V003_VALIDATOR
// The patched validator also signs the enable typed data (hotfix #2313 path).
const mockPatchedValidator = { address: V003_VALIDATOR, signTypedData: jest.fn(() => Promise.resolve('0xENABLESIG')) }
const mockGetPatchedSudoValidator = jest.fn(() => Promise.resolve(mockPatchedValidator))
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({
        getClientForChain: () => ({
            account: {
                address: USER_ADDRESS,
                kernelPluginManager: { sudoValidator: { address: mockClientSudoValidatorAddress } },
            },
        }),
        getPatchedSudoValidator: mockGetPatchedSudoValidator,
    }),
}))

import { createKernelAccount } from '@zerodev/sdk'
import { useGrantSessionKey } from '../useGrantSessionKey'

describe('useGrantSessionKey — serialized approval binds to the v0.0.3 validator', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        // createKernelAccount (mocked @zerodev/sdk) echoes the sudo validator it
        // was given so serializePermissionAccount can encode it.
        ;(createKernelAccount as jest.Mock).mockImplementation(
            (_pc: unknown, opts: { address: string; plugins: { sudo: { address: string } } }) =>
                Promise.resolve({
                    address: opts.address,
                    __sudoValidator: opts.plugins.sudo,
                    kernelPluginManager: { getAction: () => ({}), hook: undefined },
                })
        )
        mockGetSessionKeyAddress.mockResolvedValue({ address: SESSION_KEY })
        mockGetPatchedSudoValidator.mockResolvedValue(mockPatchedValidator)
        mockOverview = {
            status: { contractAddress: COLLATERAL_PROXY, coordinatorAddress: COORDINATOR },
            cards: [{ id: 'card-1' }],
        }
    })

    it('binds to v0.0.3 for a post-2025-09-18 user (client already on v0.0.3)', async () => {
        mockClientSudoValidatorAddress = V003_VALIDATOR
        const { result } = renderHook(() => useGrantSessionKey())

        let serialized: string | undefined
        await act(async () => {
            const r = await result.current.serializeGrant()
            if (r.ok) serialized = r.serialized
        })

        expect(serialized).toBe(`permission:sudo=${V003_VALIDATOR}`)
        expect(serialized).not.toContain(V002_VALIDATOR)
        // Resolved via getPatchedSudoValidator, not the client's plugin manager.
        expect(mockGetPatchedSudoValidator).toHaveBeenCalledTimes(1)
    })

    it('binds to v0.0.3 for a pre-2025-09-18 migration user (client still exposes v0.0.2)', async () => {
        // Regression guard: buggy code read the client's sudoValidator (v0.0.2)
        // and would embed 0xbA45… here → wapk-403. The fix must embed 0x7ab1….
        mockClientSudoValidatorAddress = V002_VALIDATOR
        const { result } = renderHook(() => useGrantSessionKey())

        let serialized: string | undefined
        await act(async () => {
            const r = await result.current.serializeGrant()
            if (r.ok) serialized = r.serialized
        })

        expect(serialized).toBe(`permission:sudo=${V003_VALIDATOR}`)
        expect(serialized).not.toContain(V002_VALIDATOR)
        expect(mockGetPatchedSudoValidator).toHaveBeenCalledTimes(1)
    })
})

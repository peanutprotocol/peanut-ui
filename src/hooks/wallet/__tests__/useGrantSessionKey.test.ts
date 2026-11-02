/**
 * Tests for useGrantSessionKey — the Rain card session-key grant.
 *
 * Money-path invariant under test: the serialized permission approval this hook
 * produces (which the backend replays for collateral withdrawals) MUST bind its sudo plugin to the v0.0.3 PATCHED passkey
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

import { renderHook, act, waitFor } from '@testing-library/react'

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
const mockGetFundingAccess = jest.fn()
jest.mock('@/services/rain', () => ({
    rainApi: {
        getSessionKeyAddress: (...args: unknown[]) => mockGetSessionKeyAddress(...args),
        submitWithdrawSessionApproval: (...args: unknown[]) => mockSubmitWithdrawSessionApproval(...args),
        getFundingAccess: (...args: unknown[]) => mockGetFundingAccess(...args),
    },
}))
let mockUserId = 'user-a'
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: mockUserId } } }),
}))

let mockOverview: unknown
// The hook reads the coordinator off a FRESH refetch (TASK-22734), so the
// refetch result — not the cached `overview` — is what the grant pins to.
let mockFreshOverview: unknown
const mockRefetch = jest.fn(async () => ({ isSuccess: true, data: mockFreshOverview }))
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({ overview: mockOverview, refetch: mockRefetch }),
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
}))

jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
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
const mockHandleSendUserOpEncoded = jest.fn(() => Promise.resolve({ userOpHash: '0xhash', receipt: null }))
// The connected wallet the flow starts with.
let mockConnectedAddress: string | undefined = USER_ADDRESS
jest.mock('@/hooks/useZeroDev', () => ({
    useZeroDev: () => ({ handleSendUserOpEncoded: mockHandleSendUserOpEncoded, address: mockConnectedAddress }),
}))

// The preflight repair itself is unit-tested in kernelNonceRepair.utils.test.ts;
// here we only assert the hook routes floored accounts through it and binds
// the post-repair nonce.
const mockRepairEnableNonce = jest.fn()
jest.mock('@/utils/kernelNonceRepair.utils', () => ({
    repairEnableNonce: (...args: unknown[]) => mockRepairEnableNonce(...args),
}))

const mockEnsureClient = jest.fn()
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({
        ensureClientForChain: mockEnsureClient,
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

/** The approval the backend received — the only one that ever gets replayed. */
const storedApproval = (): string | undefined =>
    (mockSubmitWithdrawSessionApproval.mock.calls[0]?.[0] as { serializedApproval?: string } | undefined)
        ?.serializedApproval

beforeEach(() => {
    jest.clearAllMocks()
    mockUserId = 'user-a'
    mockConnectedAddress = USER_ADDRESS
    // the existing cases run on a managed account (withdrawal permission only)
    mockGetFundingAccess.mockResolvedValue({ fundingMode: 'managed', enrollmentAllowed: false })
    mockEnsureClient.mockResolvedValue({ account: { address: USER_ADDRESS } })
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
        cards: [{ id: 'card-1', status: 'ACTIVE' }],
    }
    mockFreshOverview = mockOverview
    mockRefetch.mockImplementation(async () => ({ isSuccess: true, data: mockFreshOverview }))
})

describe('useGrantSessionKey — serialized approval binds to the v0.0.3 validator', () => {
    it('returns a recoverable error when wallet readiness fails, without submitting an approval', async () => {
        mockEnsureClient.mockRejectedValueOnce(new Error('Wallet initialization failed'))
        const { result } = renderHook(() => useGrantSessionKey())
        await act(async () => {
            expect(await result.current.grant()).toEqual({
                ok: false,
                error: { kind: 'unexpected', message: 'Wallet initialization failed' },
            })
        })
        expect(mockEnsureClient).toHaveBeenCalledWith('42161')
        expect(result.current.isGranting).toBe(false)
        expect(result.current.lastError).toEqual({ kind: 'unexpected', message: 'Wallet initialization failed' })
        expect(mockSubmitWithdrawSessionApproval).not.toHaveBeenCalled()
    })

    it('binds to v0.0.3 for a post-2025-09-18 user (client already on v0.0.3)', async () => {
        mockClientSudoValidatorAddress = V003_VALIDATOR
        const { result } = renderHook(() => useGrantSessionKey())

        await act(async () => {
            await result.current.grant()
        })

        const serialized = storedApproval()
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

        await act(async () => {
            await result.current.grant()
        })

        const serialized = storedApproval()
        expect(serialized).toBe(`permission:sudo=${V003_VALIDATOR}`)
        expect(serialized).not.toContain(V002_VALIDATOR)
        expect(mockGetPatchedSudoValidator).toHaveBeenCalledTimes(1)
    })
})

describe('useGrantSessionKey — the call policy pins the LIVE coordinator (TASK-22734)', () => {
    const NEW_COORDINATOR = '0x00000000000000000000000000000000000000ee'

    it('A→B: builds the withdrawAsset permission for the coordinator the FRESH overview reports, not the cached one', async () => {
        // Client-cached overview still says A (pre-upgrade); the refetch reads
        // the backend's own (repaired) metadata, which now says B.
        mockFreshOverview = {
            status: { contractAddress: COLLATERAL_PROXY, coordinatorAddress: NEW_COORDINATOR },
            cards: [{ id: 'card-1', status: 'ACTIVE' }],
        }
        const { toCallPolicy } = jest.requireMock('@zerodev/permissions/policies') as { toCallPolicy: jest.Mock }
        const { result } = renderHook(() => useGrantSessionKey())

        await act(async () => {
            const r = await result.current.grant()
            expect(r.ok).toBe(true)
        })

        // one fresh read to pin the coordinator, one after the grant to flip the flag
        expect(mockRefetch).toHaveBeenCalledTimes(2)
        const policyArgs = toCallPolicy.mock.calls[0][0] as {
            permissions: { target: string }[]
        }
        const targets = policyArgs.permissions.map((p) => p.target)
        expect(targets).toContain(NEW_COORDINATOR)
        expect(targets).not.toContain(COORDINATOR)
    })

    it('does not mint a grant when the fresh overview read fails — a stale coordinator must never be pinned', async () => {
        mockRefetch.mockImplementation(async () => ({ isSuccess: false, data: undefined, error: new Error('offline') }))
        const { result } = renderHook(() => useGrantSessionKey())

        let out: Awaited<ReturnType<typeof result.current.grant>> | undefined
        await act(async () => {
            out = await result.current.grant()
        })

        expect(out).toEqual({ ok: false, error: { kind: 'unexpected', message: 'offline' } })
        expect(mockPatchedValidator.signTypedData).not.toHaveBeenCalled()
        expect(mockSubmitWithdrawSessionApproval).not.toHaveBeenCalled()
    })

    // The 400 the grant store returns when the controller moved while this
    // approval was being saved. Keeping it typed is what lets a spend treat it
    // as a rotation candidate instead of a dead-end failure.
    it('preserves the stale-approval refusal as its own error kind', async () => {
        mockSubmitWithdrawSessionApproval.mockRejectedValueOnce(
            Object.assign(new Error('This approval targets an outdated card contract'), {
                name: 'StaleCardApprovalError',
                code: 'STALE_CARD_APPROVAL',
            })
        )
        const { result } = renderHook(() => useGrantSessionKey())

        let out: Awaited<ReturnType<typeof result.current.grant>> | undefined
        await act(async () => {
            out = await result.current.grant()
        })

        expect(out).toEqual({
            ok: false,
            error: { kind: 'stale-approval', message: 'This approval targets an outdated card contract' },
        })
    })

    it('a grant-store failure without that code stays unexpected', async () => {
        mockSubmitWithdrawSessionApproval.mockRejectedValueOnce(new Error('could not deserialize'))
        const { result } = renderHook(() => useGrantSessionKey())

        let out: Awaited<ReturnType<typeof result.current.grant>> | undefined
        await act(async () => {
            out = await result.current.grant()
        })

        expect(out).toEqual({ ok: false, error: { kind: 'unexpected', message: 'could not deserialize' } })
    })

    it('reports no-contracts when the fresh overview has no coordinator (backend has none cached)', async () => {
        mockFreshOverview = {
            status: { contractAddress: COLLATERAL_PROXY },
            cards: [{ id: 'card-1', status: 'ACTIVE' }],
        }
        const { result } = renderHook(() => useGrantSessionKey())

        let out: Awaited<ReturnType<typeof result.current.grant>> | undefined
        await act(async () => {
            out = await result.current.grant()
        })

        expect(out).toEqual({ ok: false, error: { kind: 'no-contracts' } })
        expect(mockPatchedValidator.signTypedData).not.toHaveBeenCalled()
    })

    it('on a managed account the policy targets only the coordinator, so a missing collateral proxy is not a precondition', async () => {
        mockFreshOverview = {
            status: { coordinatorAddress: COORDINATOR },
            cards: [{ id: 'card-1', status: 'ACTIVE' }],
        }
        const { result } = renderHook(() => useGrantSessionKey())

        let out: Awaited<ReturnType<typeof result.current.grant>> | undefined
        await act(async () => {
            out = await result.current.grant()
        })

        expect(out).not.toEqual({ ok: false, error: { kind: 'no-contracts' } })
    })
})

// Production pilot: what is installed follows the server's funding decision,
// read fresh right before signing. No caller picks it.
describe('useGrantSessionKey — the permission follows the funding decision', () => {
    const policyPermissions = () => {
        const { toCallPolicy } = jest.requireMock('@zerodev/permissions/policies') as { toCallPolicy: jest.Mock }
        return (toCallPolicy.mock.calls[0][0] as { permissions: { target: string; rules?: unknown[] }[] }).permissions
    }

    it.each([
        ['an account managed funding is not open to', { fundingMode: 'legacy', enrollmentAllowed: false }],
        // open to it but not accepted: still on the existing permission
        ['an account open to enrollment that has not accepted', { fundingMode: 'legacy', enrollmentAllowed: true }],
    ])('%s gets the existing card permission: top-ups to its own card plus withdrawals', async (_name, access) => {
        mockGetFundingAccess.mockResolvedValue(access)
        const { result } = renderHook(() => useGrantSessionKey())
        await act(async () => {
            expect((await result.current.grant()).ok).toBe(true)
        })
        const permissions = policyPermissions()
        expect(permissions.map((p) => p.target)).toEqual(['0x1111111111111111111111111111111111111111', COORDINATOR])
        // the top-up is pinned to this account's own collateral proxy
        expect(JSON.stringify(permissions[0].rules)).toContain(COLLATERAL_PROXY.slice(2).toLowerCase())
    })

    it.each([
        ['open to enrollment', true],
        ['no longer open to new enrollment', false],
    ])('a managed account (%s) gets the withdrawal permission only, never the existing one', async (_n, allowed) => {
        mockGetFundingAccess.mockResolvedValue({ fundingMode: 'managed', enrollmentAllowed: allowed })
        const { result } = renderHook(() => useGrantSessionKey())
        await act(async () => {
            expect((await result.current.grant()).ok).toBe(true)
        })
        expect(policyPermissions().map((p) => p.target)).toEqual([COORDINATOR])
    })

    it('the existing permission needs the collateral proxy; without it nothing is signed', async () => {
        mockGetFundingAccess.mockResolvedValue({ fundingMode: 'legacy', enrollmentAllowed: false })
        mockFreshOverview = { status: { coordinatorAddress: COORDINATOR }, cards: [{ id: 'card-1', status: 'ACTIVE' }] }
        const { result } = renderHook(() => useGrantSessionKey())
        let out: Awaited<ReturnType<typeof result.current.grant>> | undefined
        await act(async () => {
            out = await result.current.grant()
        })
        expect(out).toEqual({ ok: false, error: { kind: 'no-contracts' } })
        expect(mockPatchedValidator.signTypedData).not.toHaveBeenCalled()
    })

    it('an unreadable decision signs and stores nothing', async () => {
        mockGetFundingAccess.mockRejectedValue(new Error('funding access unavailable'))
        const { result } = renderHook(() => useGrantSessionKey())
        let out: Awaited<ReturnType<typeof result.current.grant>> | undefined
        await act(async () => {
            out = await result.current.grant()
        })
        expect(out).toEqual({ ok: false, error: { kind: 'access-unavailable', message: 'funding access unavailable' } })
        expect(mockPatchedValidator.signTypedData).not.toHaveBeenCalled()
        expect(mockSubmitWithdrawSessionApproval).not.toHaveBeenCalled()
    })

    it('a switch of account while the decision is read signs and stores nothing', async () => {
        let release!: () => void
        mockGetFundingAccess.mockImplementation(
            () =>
                new Promise((resolve) => {
                    release = () => resolve({ fundingMode: 'legacy', enrollmentAllowed: false })
                })
        )
        const { result, rerender } = renderHook(() => useGrantSessionKey())
        let pending!: ReturnType<typeof result.current.grant>
        act(() => {
            pending = result.current.grant()
        })
        await waitFor(() => expect(mockGetFundingAccess).toHaveBeenCalled())
        mockUserId = 'user-b'
        rerender()
        let out: Awaited<typeof pending> | undefined
        await act(async () => {
            release()
            out = await pending
        })
        expect(out).toEqual({ ok: false, error: { kind: 'account-changed' } })
        expect(mockPatchedValidator.signTypedData).not.toHaveBeenCalled()
        expect(mockSubmitWithdrawSessionApproval).not.toHaveBeenCalled()
    })

    it('serializeGrant signs the same permission and stores nothing (the application carries it)', async () => {
        mockGetFundingAccess.mockResolvedValue({ fundingMode: 'legacy', enrollmentAllowed: false })
        const { result } = renderHook(() => useGrantSessionKey())
        let out: Awaited<ReturnType<typeof result.current.serializeGrant>> | undefined
        await act(async () => {
            out = await result.current.serializeGrant()
        })
        expect(out).toEqual({ ok: true, serialized: expect.any(String) })
        expect(policyPermissions()).toHaveLength(2)
        expect(mockSubmitWithdrawSessionApproval).not.toHaveBeenCalled()
    })
})

// Every signing boundary re-checks the user and wallet the flow started for.
describe('useGrantSessionKey — a switch of account or wallet signs nothing further', () => {
    const toCallPolicyMock = () =>
        (jest.requireMock('@zerodev/permissions/policies') as { toCallPolicy: jest.Mock }).toCallPolicy

    it.each([
        ['account', () => (mockUserId = 'user-b')],
        ['wallet', () => (mockConnectedAddress = '0x00000000000000000000000000000000000000ff')],
    ])('a %s switch while the policy is built prompts no passkey and stores nothing', async (_n, switchTo) => {
        let built!: () => void
        toCallPolicyMock().mockImplementationOnce(
            () => new Promise((resolve) => (built = () => resolve({ policy: 'call' })))
        )
        const { result, rerender } = renderHook(() => useGrantSessionKey())
        let pending!: ReturnType<typeof result.current.grant>
        act(() => {
            pending = result.current.grant()
        })
        await waitFor(() => expect(toCallPolicyMock()).toHaveBeenCalled())
        switchTo()
        rerender()
        let out: Awaited<typeof pending> | undefined
        await act(async () => {
            built()
            out = await pending
        })
        expect(out).toEqual({ ok: false, error: { kind: 'account-changed' } })
        expect(mockEnsureClient).not.toHaveBeenCalled()
        expect(mockPatchedValidator.signTypedData).not.toHaveBeenCalled()
        expect(mockSubmitWithdrawSessionApproval).not.toHaveBeenCalled()
    })

    it('a wallet that changes while the signer prepares the kernel prompts no passkey', async () => {
        const OTHER_WALLET = '0x00000000000000000000000000000000000000ff'
        const { result, rerender } = renderHook(() => useGrantSessionKey())
        // the kernel the signer prepares is already the next wallet's
        mockEnsureClient.mockImplementationOnce(async () => {
            mockConnectedAddress = OTHER_WALLET
            rerender()
            return { account: { address: OTHER_WALLET } }
        })
        let out: Awaited<ReturnType<typeof result.current.grant>> | undefined
        await act(async () => {
            out = await result.current.grant()
        })
        expect(out).toEqual({ ok: false, error: { kind: 'account-changed' } })
        expect(mockPatchedValidator.signTypedData).not.toHaveBeenCalled()
        expect(mockSubmitWithdrawSessionApproval).not.toHaveBeenCalled()
    })

    it('a switch while the signer reads the wallet state prompts no passkey', async () => {
        const { peanutPublicClient } = jest.requireMock('@/app/actions/clients') as {
            peanutPublicClient: { getCode: jest.Mock }
        }
        let read!: () => void
        peanutPublicClient.getCode.mockImplementationOnce(
            () => new Promise((resolve) => (read = () => resolve('0xdeadbeef')))
        )
        const { result, rerender } = renderHook(() => useGrantSessionKey())
        let pending!: ReturnType<typeof result.current.grant>
        act(() => {
            pending = result.current.grant()
        })
        await waitFor(() => expect(peanutPublicClient.getCode).toHaveBeenCalled())
        mockUserId = 'user-b'
        rerender()
        let out: Awaited<typeof pending> | undefined
        await act(async () => {
            read()
            out = await pending
        })
        expect(out).toEqual({ ok: false, error: { kind: 'account-changed' } })
        expect(mockPatchedValidator.signTypedData).not.toHaveBeenCalled()
        expect(mockSubmitWithdrawSessionApproval).not.toHaveBeenCalled()
    })

    it('a kernel prepared for another wallet is refused even when the hook has not re-rendered yet', async () => {
        mockEnsureClient.mockResolvedValueOnce({ account: { address: '0x00000000000000000000000000000000000000ff' } })
        const { result } = renderHook(() => useGrantSessionKey())
        let out: Awaited<ReturnType<typeof result.current.serializeGrant>> | undefined
        await act(async () => {
            out = await result.current.serializeGrant()
        })
        expect(out).toEqual({ ok: false, error: { kind: 'account-changed' } })
        expect(mockPatchedValidator.signTypedData).not.toHaveBeenCalled()
    })

    it('a switch after the approval is stored refreshes nothing for the next account', async () => {
        let stored!: () => void
        mockSubmitWithdrawSessionApproval.mockImplementationOnce(
            () => new Promise<void>((resolve) => (stored = () => resolve()))
        )
        const { result, rerender } = renderHook(() => useGrantSessionKey())
        let pending!: ReturnType<typeof result.current.grant>
        act(() => {
            pending = result.current.grant()
        })
        await waitFor(() => expect(mockSubmitWithdrawSessionApproval).toHaveBeenCalled())
        mockUserId = 'user-b'
        rerender()
        let out: Awaited<typeof pending> | undefined
        await act(async () => {
            stored()
            out = await pending
        })
        expect(out).toEqual({ ok: false, error: { kind: 'account-changed' } })
        // only the fresh read before signing; no post-grant refetch for user-b
        expect(mockRefetch).toHaveBeenCalledTimes(1)
    })

    it('a switch during the passkey signature sends no approval under the next session', async () => {
        let signed!: () => void
        mockPatchedValidator.signTypedData.mockImplementationOnce(
            () => new Promise((resolve) => (signed = () => resolve('0xENABLESIG')))
        )
        const { result, rerender } = renderHook(() => useGrantSessionKey())
        let pending!: ReturnType<typeof result.current.grant>
        act(() => {
            pending = result.current.grant()
        })
        await waitFor(() => expect(mockPatchedValidator.signTypedData).toHaveBeenCalled())
        mockUserId = 'user-b'
        rerender()
        let out: Awaited<typeof pending> | undefined
        await act(async () => {
            signed()
            out = await pending
        })
        expect(out).toEqual({ ok: false, error: { kind: 'account-changed' } })
        expect(mockSubmitWithdrawSessionApproval).not.toHaveBeenCalled()
    })

    // The connected wallet is published once the wallet is up. Before that the
    // signer has no wallet to hold the kernel to, so nothing is signed: the tap
    // only brings the wallet up, and the next one signs for the known wallet.
    it('with no known wallet yet it signs nothing, even if a kernel for some wallet comes back', async () => {
        mockConnectedAddress = undefined
        mockEnsureClient.mockResolvedValueOnce({ account: { address: '0x00000000000000000000000000000000000000ff' } })
        const { result } = renderHook(() => useGrantSessionKey())
        let out: Awaited<ReturnType<typeof result.current.grant>> | undefined
        await act(async () => {
            out = await result.current.grant()
        })
        expect(out).toEqual({ ok: false, error: { kind: 'unexpected', message: 'Wallet not ready yet' } })
        expect(mockEnsureClient).toHaveBeenCalledWith('42161')
        expect(mockGetFundingAccess).not.toHaveBeenCalled()
        expect(mockGetSessionKeyAddress).not.toHaveBeenCalled()
        expect(mockPatchedValidator.signTypedData).not.toHaveBeenCalled()
        expect(mockSubmitWithdrawSessionApproval).not.toHaveBeenCalled()
    })

    it('with no known wallet a failed initialization is reported for a retry', async () => {
        mockConnectedAddress = undefined
        mockEnsureClient.mockRejectedValueOnce(new Error('Wallet initialization failed'))
        const { result } = renderHook(() => useGrantSessionKey())
        let out: Awaited<ReturnType<typeof result.current.grant>> | undefined
        await act(async () => {
            out = await result.current.grant()
        })
        expect(out).toEqual({ ok: false, error: { kind: 'unexpected', message: 'Wallet initialization failed' } })
        expect(mockPatchedValidator.signTypedData).not.toHaveBeenCalled()
    })

    it('serializeGrant handed over for another account or wallet reads and signs nothing', async () => {
        const { result } = renderHook(() => useGrantSessionKey())
        let out: Awaited<ReturnType<typeof result.current.serializeGrant>> | undefined
        await act(async () => {
            out = await result.current.serializeGrant({ userId: 'user-a', connectedAddress: '0xother' })
        })
        expect(out).toEqual({ ok: false, error: { kind: 'account-changed' } })
        expect(mockRefetch).not.toHaveBeenCalled()
        expect(mockGetFundingAccess).not.toHaveBeenCalled()
        expect(result.current.lastError).toBeNull()
    })

    it('serializeGrant handed over for this account and wallet signs as usual', async () => {
        const { result } = renderHook(() => useGrantSessionKey())
        let out: Awaited<ReturnType<typeof result.current.serializeGrant>> | undefined
        await act(async () => {
            out = await result.current.serializeGrant({ userId: 'user-a', connectedAddress: USER_ADDRESS })
        })
        expect(out).toEqual({ ok: true, serialized: expect.any(String) })
    })
})

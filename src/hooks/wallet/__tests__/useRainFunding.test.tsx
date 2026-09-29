/**
 * Contract tests for useRainFunding — managed card funding. One scoped,
 * approve-only permission is signed by the user and handed to the backend,
 * which enables it and keeps a finite allowance for the provider's operator.
 *
 * Locked down:
 *  1. consent is a hard gate: both boxes and the exact statement, or nothing is
 *     read, signed or sent
 *  2. the signed permission is one approve-only policy: exact token, exact
 *     operator, amount capped at the backend's ceiling — never maxUint256, and
 *     the client never sends an approve UserOp itself
 *  3. wrong chain / token / operator / wallet / ceiling / scope never builds a
 *     client or signs
 *  4. readiness is only the backend's word: an allowance is never consent, an
 *     accepted POST is not "ready", a state that still asks for a grant means
 *     the grant was not taken
 *  5. a legacy grant (`migration_required`) is retired with a root userOp
 *     first and the new permission is signed only after the backend confirms
 *  6. an account or wallet switch mid-flow stops the grant before anything is sent
 *  7. pending waits and rechecks; cancel and failure are typed; one grant at a time
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { maxUint256 } from 'viem'
import { rainApi } from '@/services/rain'
import { ApiError } from '@/services/api-error'

const WALLET = '0xc97fffbf8768ca90cd62fae2e313b084fe13e553'
const OTHER_WALLET = '0x1111111111111111111111111111111111111111'
const OPERATOR = '0x5a6E6b0d5Ea051CfFF9b3dcC2Aa8Dac226458f29'
const TOKEN = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
const SESSION_KEY = '0x4300F803a281e257F3C1de001512e68972f8d022'
const AUTHORIZATION = 'I authorize transfers according to the Real-Time Funding Terms.'
const CEILING = '300000000'

jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
}))
jest.mock('@/app/actions/clients', () => ({ peanutPublicClient: { readContract: jest.fn(), getCode: jest.fn() } }))
jest.mock('@/services/rain', () => ({ rainApi: { getCardFunding: jest.fn(), submitFundingGrant: jest.fn() } }))
let mockUserId = 'user-a'
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: mockUserId } } }),
}))
const mockEnsureClientForChain = jest.fn()
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({
        ensureClientForChain: mockEnsureClientForChain,
        getPatchedSudoValidator: jest.fn(),
        rebuildClientForChain: jest.fn(),
    }),
}))
const mockHandleSendUserOpEncoded = jest.fn()
let mockConnectedAddress = WALLET
jest.mock('@/hooks/useZeroDev', () => ({
    useZeroDev: () => ({ handleSendUserOpEncoded: mockHandleSendUserOpEncoded, address: mockConnectedAddress }),
}))
const mockSignKernelPermission = jest.fn()
jest.mock('@/hooks/wallet/signKernelPermission', () => ({
    signKernelPermission: (...args: unknown[]) => mockSignKernelPermission(...args),
    PermissionWalletMismatchError: class PermissionWalletMismatchError extends Error {},
}))
const mockToCallPolicy = jest.fn()
const mockToSignatureCallerPolicy = jest.fn()
jest.mock('@zerodev/permissions/policies', () => ({
    toCallPolicy: (...args: unknown[]) => mockToCallPolicy(...args),
    toSignatureCallerPolicy: (...args: unknown[]) => mockToSignatureCallerPolicy(...args),
    CallPolicyVersion: { V0_0_4: 'V0_0_4' },
    ParamCondition: { EQUAL: 'EQUAL', LESS_THAN_OR_EQUAL: 'LESS_THAN_OR_EQUAL' },
}))
const mockRetireLegacyGrants = jest.fn()
// The payload check is real; only the on-chain userOp is replaced.
jest.mock('@/utils/legacyGrantMigration.utils', () => ({
    ...jest.requireActual('@/utils/legacyGrantMigration.utils'),
    retireLegacyGrants: (...args: unknown[]) => mockRetireLegacyGrants(...args),
}))

import { useRainFunding } from '../useRainFunding'

type Status = 'required' | 'migration_required' | 'pending' | 'ready' | 'temporarily_unavailable'
const funding = (status: Status = 'required', overrides: Record<string, unknown> = {}, migration: unknown = null) => ({
    chainId: '42161',
    tokenAddress: TOKEN,
    operatorAddress: OPERATOR,
    walletAddress: WALLET,
    allowance: '0',
    sessionKeyAddress: SESSION_KEY,
    permission: {
        scopeVersion: 2,
        ceiling: CEILING,
        termsVersion: 'rtf-2026-09-29',
        authorizationText: AUTHORIZATION,
    },
    management: { status, reason: null, migration },
    ...overrides,
})

// The backend's migration payload: one legacy permission validation to uninstall.
const LEGACY_ID = `0x02${'ab'.repeat(20)}`
const MIGRATION = { uninstall: [{ validationId: LEGACY_ID, deinitData: '0x1234' }], invalidateNonceFloor: 5 }

const CONSENT = { managementAccepted: true, authorizationAccepted: true, authorizationText: AUTHORIZATION }

let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
)

const mockGetCardFunding = rainApi.getCardFunding as jest.Mock
const mockSubmitFundingGrant = rainApi.submitFundingGrant as jest.Mock

beforeEach(() => {
    jest.clearAllMocks()
    mockUserId = 'user-a'
    mockConnectedAddress = WALLET
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mockGetCardFunding.mockResolvedValue(funding())
    mockEnsureClientForChain.mockResolvedValue({ account: { address: WALLET } })
    mockToCallPolicy.mockResolvedValue({ __policy: 'call' })
    mockToSignatureCallerPolicy.mockResolvedValue({ __policy: 'no-signatures' })
    mockSignKernelPermission.mockResolvedValue('SERIALIZED_PERMISSION')
    mockSubmitFundingGrant.mockResolvedValue(funding('pending'))
    mockRetireLegacyGrants.mockResolvedValue(undefined)
})

const runGrant = async (consent = CONSENT) => {
    const hook = renderHook(() => useRainFunding({ enabled: false }), { wrapper })
    let out!: Awaited<ReturnType<typeof hook.result.current.grant>>
    await act(async () => {
        out = await hook.result.current.grant(consent)
    })
    return { out, hook }
}

const nothingSigned = () => {
    expect(mockSignKernelPermission).not.toHaveBeenCalled()
    expect(mockSubmitFundingGrant).not.toHaveBeenCalled()
    expect(mockHandleSendUserOpEncoded).not.toHaveBeenCalled()
}

describe('useRainFunding.grant — the signed permission', () => {
    it('signs one approve-only policy capped at the backend ceiling, posts it with the consent, and reports pending', async () => {
        const { out } = await runGrant()

        expect(out).toEqual({ ok: true, status: 'pending' })
        expect(mockToCallPolicy).toHaveBeenCalledTimes(1)
        const { policyVersion, permissions } = mockToCallPolicy.mock.calls[0][0]
        expect(policyVersion).toBe('V0_0_4')
        expect(permissions).toHaveLength(1)
        expect(permissions[0]).toEqual(
            expect.objectContaining({ target: TOKEN, functionName: 'approve', valueLimit: 0n })
        )
        expect(permissions[0].args).toEqual([
            { condition: 'EQUAL', value: OPERATOR },
            { condition: 'LESS_THAN_OR_EQUAL', value: 300_000_000n },
        ])
        expect(mockSignKernelPermission).toHaveBeenCalledWith(
            expect.objectContaining({
                // exactly two policies, in this order
                policies: [{ __policy: 'call' }, { __policy: 'no-signatures' }],
                sessionKeyAddress: SESSION_KEY,
                expectedAccount: WALLET,
            })
        )
        expect(mockSubmitFundingGrant).toHaveBeenCalledWith({
            serializedPermission: 'SERIALIZED_PERMISSION',
            consent: {
                termsVersion: 'rtf-2026-09-29',
                managementAccepted: true,
                authorizationText: AUTHORIZATION,
            },
        })
    })

    it('denies every ERC-1271 signature: a signature-caller policy with no allowed callers and no flag override', async () => {
        await runGrant()

        expect(mockToSignatureCallerPolicy).toHaveBeenCalledTimes(1)
        // exactly this argument: no callers, and no policyFlag (the default is for all validation)
        expect(mockToSignatureCallerPolicy).toHaveBeenCalledWith({ allowedCallers: [] })
        // and no validator-level flag, which serialization drops
        expect(mockSignKernelPermission.mock.calls[0][0]).not.toHaveProperty('flag')
        expect(mockSignKernelPermission.mock.calls[0][0].policies).toHaveLength(2)
    })

    it('never sends an approve userOp and never signs an unlimited amount', async () => {
        await runGrant()

        expect(mockHandleSendUserOpEncoded).not.toHaveBeenCalled()
        const ceilingRule = mockToCallPolicy.mock.calls[0][0].permissions[0].args[1]
        expect(ceilingRule.value).toBeLessThan(maxUint256)
        expect(
            JSON.stringify(mockSubmitFundingGrant.mock.calls[0][0], (_k, v) => (typeof v === 'bigint' ? `${v}n` : v))
        ).not.toContain(maxUint256.toString())
    })

    it('signs against the fresh read, not a cached one', async () => {
        const { hook } = await runGrant()
        expect(mockGetCardFunding).toHaveBeenCalledTimes(1)
        mockGetCardFunding.mockResolvedValue(
            funding('required', { permission: { ...funding().permission, ceiling: '250000000' } })
        )
        await act(async () => {
            await hook.result.current.grant(CONSENT)
        })
        const second = mockToCallPolicy.mock.calls[1][0].permissions[0].args[1]
        expect(second.value).toBe(250_000_000n)
    })

    it('a positive allowance is not consent: a required state still asks for a grant', async () => {
        mockGetCardFunding.mockResolvedValue(funding('required', { allowance: maxUint256.toString() }))
        const { out } = await runGrant()
        expect(out).toEqual({ ok: true, status: 'pending' })
        expect(mockSignKernelPermission).toHaveBeenCalledTimes(1)
    })
})

describe('useRainFunding.grant — consent gates', () => {
    it.each([
        ['management box', { ...CONSENT, managementAccepted: false }],
        ['authorization box', { ...CONSENT, authorizationAccepted: false }],
    ])('an unticked %s reads, signs and sends nothing', async (_name, consent) => {
        const { out, hook } = await runGrant(consent)
        expect(out).toEqual({ ok: false, error: { kind: 'consent-required' } })
        expect(hook.result.current.lastError).toEqual({ kind: 'consent-required' })
        expect(mockGetCardFunding).not.toHaveBeenCalled()
        nothingSigned()
    })

    it('a statement that is not the one on record signs nothing and shows the current text', async () => {
        const { out, hook } = await runGrant({ ...CONSENT, authorizationText: 'I authorize something else.' })
        expect(out).toEqual({ ok: false, error: { kind: 'terms-changed' } })
        nothingSigned()
        expect(hook.result.current.lastError).toEqual({ kind: 'terms-changed' })
        expect(client.getQueryData(['rain-card-funding', 'user-a'])).toEqual(funding())
    })

    it.each<Status>(['ready', 'temporarily_unavailable'])(
        'a %s state needs no grant: nothing is signed and no prompt is raised',
        async (status) => {
            mockGetCardFunding.mockResolvedValue(funding(status, { allowance: '0' }))
            const { out } = await runGrant()
            expect(out).toEqual({ ok: true, status })
            expect(mockEnsureClientForChain).not.toHaveBeenCalled()
            nothingSigned()
        }
    )

    it.each<Status>(['required', 'migration_required'])(
        'a retired permission (%s + scope_retired) is never re-signed and raises no prompt',
        async (status) => {
            mockGetCardFunding.mockResolvedValue(
                funding(status, { management: { status, reason: 'scope_retired', migration: MIGRATION } })
            )
            const { out, hook } = await runGrant()
            expect(out).toEqual({ ok: false, error: { kind: 'scope-retired' } })
            expect(mockRetireLegacyGrants).not.toHaveBeenCalled()
            expect(mockEnsureClientForChain).not.toHaveBeenCalled()
            nothingSigned()
            expect(hook.result.current.lastError).toEqual({ kind: 'scope-retired' })
        }
    )

    it.each([
        ['scope_retired', 'scope-retired'],
        ['funding_unavailable', 'unavailable'],
    ])('a %s refusal is final: the state is re-read so the prompt ends, and there is no retry', async (code, kind) => {
        const invalidate = jest.spyOn(client, 'invalidateQueries')
        mockSubmitFundingGrant.mockRejectedValue(new ApiError('final', { status: 409, code }))
        const { out } = await runGrant()
        expect(out).toEqual({ ok: false, error: { kind } })
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['rain-card-funding', 'user-a'] })
        expect(mockSignKernelPermission).toHaveBeenCalledTimes(1)
    })

    it('a pending state waits: it does not sign a second permission', async () => {
        mockGetCardFunding.mockResolvedValue(funding('pending'))
        const { out } = await runGrant()
        expect(out).toEqual({ ok: true, status: 'pending' })
        nothingSigned()
    })
})

describe('useRainFunding.grant — wrong chain, token, operator, wallet or bounds', () => {
    it.each([
        ['chain', { chainId: '1' }],
        ['token', { tokenAddress: '0x2222222222222222222222222222222222222222' }],
        ['zero operator', { operatorAddress: '0x0000000000000000000000000000000000000000' }],
        ['operator equal to the token', { operatorAddress: TOKEN }],
        ['malformed operator', { operatorAddress: 'operator' }],
        ['zero session signer', { sessionKeyAddress: '0x0000000000000000000000000000000000000000' }],
        ['missing session signer', { sessionKeyAddress: '' }],
    ])('a wrong %s builds no kernel client and signs nothing', async (_name, overrides) => {
        mockGetCardFunding.mockResolvedValue(funding('required', overrides))
        const { out } = await runGrant()
        expect(out).toEqual({ ok: false, error: { kind: 'config-mismatch' } })
        expect(mockEnsureClientForChain).not.toHaveBeenCalled()
        nothingSigned()
    })

    it.each([
        ['zero ceiling', { ceiling: '0' }],
        ['non-numeric ceiling', { ceiling: 'lots' }],
        ['unknown scope version', { scopeVersion: 3 }],
        ['old one-policy scope', { scopeVersion: 1 }],
        ['empty terms version', { termsVersion: '' }],
    ])('a %s is not signed', async (_name, permission) => {
        mockGetCardFunding.mockResolvedValue(
            funding('required', { permission: { ...funding().permission, ...permission } })
        )
        const { out } = await runGrant()
        expect(out).toEqual({ ok: false, error: { kind: 'config-mismatch' } })
        nothingSigned()
    })

    it('a connected wallet that is not the funded wallet never signs', async () => {
        mockEnsureClientForChain.mockResolvedValue({ account: { address: OTHER_WALLET } })
        const { out } = await runGrant()
        expect(out).toEqual({ ok: false, error: { kind: 'wallet-mismatch' } })
        nothingSigned()
    })

    it('a wallet mismatch caught while signing is a wallet mismatch, not a generic failure', async () => {
        const { PermissionWalletMismatchError } = jest.requireMock('@/hooks/wallet/signKernelPermission')
        mockSignKernelPermission.mockRejectedValue(new PermissionWalletMismatchError())
        const { out } = await runGrant()
        expect(out).toEqual({ ok: false, error: { kind: 'wallet-mismatch' } })
        expect(mockSubmitFundingGrant).not.toHaveBeenCalled()
    })

    it.each([
        ['no card account', new ApiError('none', { status: 404, code: 'no_rain_account' }), 'no-account'],
        ['another wallet', new ApiError('other', { status: 409, code: 'card_wallet_mismatch' }), 'wallet-mismatch'],
    ])('%s on the read is typed and signs nothing', async (_name, error, kind) => {
        mockGetCardFunding.mockRejectedValue(error)
        const { out } = await runGrant()
        expect(out).toEqual({ ok: false, error: { kind } })
        nothingSigned()
    })

    it('an unreadable funding state fails closed — never read as "not granted"', async () => {
        mockGetCardFunding.mockRejectedValue(new ApiError('down', { status: 503, code: 'funding_status_unavailable' }))
        const { out } = await runGrant()
        expect(out).toEqual({ ok: false, error: { kind: 'funding-unavailable', message: 'down' } })
        nothingSigned()
    })
})

describe('useRainFunding.grant — the backend decides what is granted', () => {
    it('reports ready only when the backend answers ready, and caches that answer', async () => {
        mockSubmitFundingGrant.mockResolvedValue(funding('ready'))
        const { out } = await runGrant()
        expect(out).toEqual({ ok: true, status: 'ready' })
        expect(
            (client.getQueryData(['rain-card-funding', 'user-a']) as ReturnType<typeof funding>).management.status
        ).toBe('ready')
    })

    it('an accepted POST that still asks for a grant is not "granted"', async () => {
        mockSubmitFundingGrant.mockResolvedValue(funding('required'))
        const { out } = await runGrant()
        expect(out).toEqual({ ok: false, error: { kind: 'rejected' } })
    })

    it.each([
        ['consent_required', 400, 'consent-required'],
        ['invalid_permission', 400, 'rejected'],
        ['migration_required', 409, 'migration-pending'],
        ['card_wallet_mismatch', 409, 'wallet-mismatch'],
        ['funding_unavailable', 503, 'funding-unavailable'],
        ['funding_unavailable', 409, 'unavailable'],
    ])('a %s refusal is typed', async (code, status, kind) => {
        mockSubmitFundingGrant.mockRejectedValue(new ApiError('refused', { status, code }))
        const { out } = await runGrant()
        expect(out.ok).toBe(false)
        expect(!out.ok && out.error.kind).toBe(kind)
    })

    it('a grant already in flight is pending, not a failure', async () => {
        mockSubmitFundingGrant.mockRejectedValue(new ApiError('busy', { status: 409, code: 'grant_in_progress' }))
        const { out } = await runGrant()
        expect(out).toEqual({ ok: true, status: 'pending' })
    })
})

describe('useRainFunding.grant — cancel, failure and single flight', () => {
    it('a dismissed passkey is a cancel and nothing is posted', async () => {
        mockSignKernelPermission.mockRejectedValue(Object.assign(new Error('rejected'), { name: 'NotAllowedError' }))
        const { out, hook } = await runGrant()
        expect(out).toEqual({ ok: false, error: { kind: 'user-cancelled' } })
        expect(hook.result.current.lastError).toEqual({ kind: 'user-cancelled' })
        expect(hook.result.current.isSubmitting).toBe(false)
        expect(mockSubmitFundingGrant).not.toHaveBeenCalled()
    })

    it('an unexpected signing failure is typed and the next try starts clean', async () => {
        mockSignKernelPermission.mockRejectedValueOnce(new Error('AA23'))
        const { out, hook } = await runGrant()
        expect(out).toEqual({ ok: false, error: { kind: 'unexpected', message: 'AA23' } })
        await act(async () => {
            expect((await hook.result.current.grant(CONSENT)).ok).toBe(true)
        })
        expect(hook.result.current.lastError).toBeNull()
    })

    it('a double tap signs and posts once', async () => {
        const hook = renderHook(() => useRainFunding({ enabled: false }), { wrapper })
        await act(async () => {
            const [a, b] = await Promise.all([hook.result.current.grant(CONSENT), hook.result.current.grant(CONSENT)])
            expect(b).toBe(a)
        })
        expect(mockGetCardFunding).toHaveBeenCalledTimes(1)
        expect(mockSignKernelPermission).toHaveBeenCalledTimes(1)
        expect(mockSubmitFundingGrant).toHaveBeenCalledTimes(1)
    })
})

// A grant is paused at one of its awaits (`gate`), the identity switches and
// renders while it waits, and then it is let go. Renders inside an async `act`
// are held until it returns, so the grant starts outside `act` and only its
// result is awaited inside one.
const deferred = () => {
    let release!: () => void
    const promise = new Promise<void>((resolve) => {
        release = resolve
    })
    return { promise, release }
}
const startGrant = (hook: { result: { current: ReturnType<typeof useRainFunding> } }) =>
    hook.result.current.grant(CONSENT)
const finish = async (pending: ReturnType<typeof startGrant>) => {
    let out!: Awaited<typeof pending>
    await act(async () => {
        out = await pending
    })
    return out
}
const switchIdentity = (hook: { rerender: () => void }, change: () => void) =>
    act(() => {
        change()
        hook.rerender()
    })

describe('useRainFunding.grant — account or wallet change mid-flow', () => {
    it('a switch of account while signing stops before the POST', async () => {
        const hook = renderHook(() => useRainFunding({ enabled: false }), { wrapper })
        const gate = deferred()
        mockSignKernelPermission.mockImplementation(async () => {
            await gate.promise
            return 'SERIALIZED_PERMISSION'
        })
        const pending = startGrant(hook)
        await waitFor(() => expect(mockSignKernelPermission).toHaveBeenCalled())
        switchIdentity(hook, () => {
            mockUserId = 'user-b'
        })
        gate.release()

        expect(await finish(pending)).toEqual({ ok: false, error: { kind: 'account-changed' } })
        expect(mockSubmitFundingGrant).not.toHaveBeenCalled()
        // the second account's cache is never written with the first account's grant
        expect(client.getQueryData(['rain-card-funding', 'user-b'])).toBeUndefined()
    })

    it('a switch of connected wallet while signing stops before the POST', async () => {
        const hook = renderHook(() => useRainFunding({ enabled: false }), { wrapper })
        const gate = deferred()
        mockSignKernelPermission.mockImplementation(async () => {
            await gate.promise
            return 'SERIALIZED_PERMISSION'
        })
        const pending = startGrant(hook)
        await waitFor(() => expect(mockSignKernelPermission).toHaveBeenCalled())
        switchIdentity(hook, () => {
            mockConnectedAddress = OTHER_WALLET
        })
        gate.release()

        expect(await finish(pending)).toEqual({ ok: false, error: { kind: 'account-changed' } })
        expect(mockSubmitFundingGrant).not.toHaveBeenCalled()
    })

    it('a switch of account while the state is read signs nothing', async () => {
        const hook = renderHook(() => useRainFunding({ enabled: false }), { wrapper })
        const gate = deferred()
        mockGetCardFunding.mockImplementation(async () => {
            await gate.promise
            return funding()
        })
        const pending = startGrant(hook)
        await waitFor(() => expect(mockGetCardFunding).toHaveBeenCalled())
        switchIdentity(hook, () => {
            mockUserId = 'user-b'
        })
        gate.release()

        expect(await finish(pending)).toEqual({ ok: false, error: { kind: 'account-changed' } })
        nothingSigned()
    })
})

describe('useRainFunding.grant — a legacy grant (migration_required)', () => {
    const legacy = () => funding('migration_required', {}, MIGRATION)

    it('retires the old grant with a root userOp first, then signs against the confirmed state — two confirmations', async () => {
        const order: string[] = []
        mockGetCardFunding
            .mockImplementationOnce(async () => {
                order.push('read')
                return legacy()
            })
            .mockImplementationOnce(async () => {
                order.push('re-read')
                return funding('required')
            })
        mockRetireLegacyGrants.mockImplementation(async () => order.push('invalidate'))
        mockSignKernelPermission.mockImplementation(async () => {
            order.push('sign')
            return 'SERIALIZED_PERMISSION'
        })
        mockSubmitFundingGrant.mockImplementation(async () => {
            order.push('post')
            return funding('pending')
        })

        const { out } = await runGrant()

        expect(order).toEqual(['read', 'invalidate', 're-read', 'sign', 'post'])
        expect(out).toEqual({ ok: true, status: 'pending' })
        // the checked backend payload reaches the on-chain step untouched
        expect(mockRetireLegacyGrants).toHaveBeenCalledWith(
            expect.objectContaining({
                accountAddress: WALLET,
                migration: {
                    uninstalls: [{ validationId: LEGACY_ID, deinitData: '0x1234' }],
                    invalidateNonceFloor: 5,
                },
            })
        )
    })

    it('sends the migration as ONE userOp with every call, not one userOp per call', async () => {
        mockGetCardFunding.mockResolvedValueOnce(legacy()).mockResolvedValueOnce(funding('required'))
        mockRetireLegacyGrants.mockImplementation(
            async (deps: { sendUserOp: (calls: unknown[]) => Promise<unknown> }) => {
                await deps.sendUserOp([{ to: WALLET }, { to: WALLET }])
            }
        )
        mockHandleSendUserOpEncoded.mockResolvedValue({ receipt: null })
        await runGrant()
        expect(mockHandleSendUserOpEncoded).toHaveBeenCalledTimes(1)
        expect(mockHandleSendUserOpEncoded).toHaveBeenCalledWith([{ to: WALLET }, { to: WALLET }], '42161')
    })

    it('a migration that is still running elsewhere on the wallet sends nothing and asks to try again', async () => {
        mockGetCardFunding.mockResolvedValue(legacy())
        const { KernelSigningBusyError } = jest.requireActual('@/utils/kernelSigningGuard')
        mockRetireLegacyGrants.mockRejectedValue(new KernelSigningBusyError('signing-open'))
        const { out } = await runGrant()
        expect(out).toEqual({ ok: false, error: { kind: 'busy' } })
        nothingSigned()
    })

    it('reports which confirmation is running, then goes idle', async () => {
        const hook = renderHook(() => useRainFunding({ enabled: false }), { wrapper })
        mockGetCardFunding.mockResolvedValueOnce(legacy()).mockResolvedValueOnce(funding('required'))
        const update = deferred()
        const sign = deferred()
        mockRetireLegacyGrants.mockImplementation(() => update.promise)
        mockSignKernelPermission.mockImplementation(async () => {
            await sign.promise
            return 'SERIALIZED_PERMISSION'
        })

        expect(hook.result.current.step).toBe('idle')
        const pending = startGrant(hook)
        await waitFor(() => expect(hook.result.current.step).toBe('updating-permission'))
        update.release()
        await waitFor(() => expect(hook.result.current.step).toBe('signing'))
        sign.release()

        expect(await finish(pending)).toEqual({ ok: true, status: 'pending' })
        expect(hook.result.current.step).toBe('idle')
        expect(hook.result.current.isSubmitting).toBe(false)
    })

    it('does not sign the new permission while the backend still sees the old grant', async () => {
        mockGetCardFunding.mockResolvedValue(legacy())
        const { out } = await runGrant()
        expect(out).toEqual({ ok: false, error: { kind: 'migration-pending' } })
        expect(mockRetireLegacyGrants).toHaveBeenCalledTimes(1)
        expect(mockSignKernelPermission).not.toHaveBeenCalled()
        expect(mockSubmitFundingGrant).not.toHaveBeenCalled()
    })

    it('a cancelled update confirmation signs and sends nothing', async () => {
        mockGetCardFunding.mockResolvedValue(legacy())
        mockRetireLegacyGrants.mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' }))
        const { out } = await runGrant()
        expect(out).toEqual({ ok: false, error: { kind: 'user-cancelled' } })
        expect(mockSignKernelPermission).not.toHaveBeenCalled()
    })

    it('an update that is sent but not confirmed on chain yet asks to re-check, never to sign', async () => {
        mockGetCardFunding.mockResolvedValue(legacy())
        mockRetireLegacyGrants.mockRejectedValue(
            Object.assign(new Error('slow'), { name: 'KernelNonceRepairPendingError' })
        )
        const { out } = await runGrant()
        expect(out).toEqual({ ok: false, error: { kind: 'migration-pending' } })
        expect(mockSignKernelPermission).not.toHaveBeenCalled()
    })

    it.each([
        ['an empty uninstall list', { ...MIGRATION, uninstall: [] }],
        ['a missing uninstall list', { invalidateNonceFloor: 5 }],
        [
            'the root validator id',
            { ...MIGRATION, uninstall: [{ validationId: `0x00${'ab'.repeat(20)}`, deinitData: '0x12' }] },
        ],
        ['a short validation id', { ...MIGRATION, uninstall: [{ validationId: '0x02abcd', deinitData: '0x12' }] }],
        ['non-hex deinit data', { ...MIGRATION, uninstall: [{ validationId: LEGACY_ID, deinitData: 'nope' }] }],
        ['empty deinit data', { ...MIGRATION, uninstall: [{ validationId: LEGACY_ID, deinitData: '0x' }] }],
        ['a duplicate id', { ...MIGRATION, uninstall: [MIGRATION.uninstall[0], MIGRATION.uninstall[0]] }],
        ['a zero floor', { ...MIGRATION, invalidateNonceFloor: 0 }],
        ['a fractional floor', { ...MIGRATION, invalidateNonceFloor: 1.5 }],
        ['the old nonce-only payload', { invalidateNonce: 5 }],
    ])('%s is refused before any userOp and nothing is signed', async (_name, payload) => {
        mockGetCardFunding.mockResolvedValue(funding('migration_required', {}, payload))
        const { out } = await runGrant()
        expect(out).toEqual({ ok: false, error: { kind: 'config-mismatch' } })
        expect(mockRetireLegacyGrants).not.toHaveBeenCalled()
        expect(mockSignKernelPermission).not.toHaveBeenCalled()
        expect(mockSubmitFundingGrant).not.toHaveBeenCalled()
    })

    it('a legacy state without a migration target is refused', async () => {
        mockGetCardFunding.mockResolvedValue(funding('migration_required'))
        const { out } = await runGrant()
        expect(out).toEqual({ ok: false, error: { kind: 'config-mismatch' } })
        expect(mockRetireLegacyGrants).not.toHaveBeenCalled()
    })

    it('an account switch after the update stops before signing', async () => {
        const hook = renderHook(() => useRainFunding({ enabled: false }), { wrapper })
        mockGetCardFunding.mockResolvedValue(legacy())
        const update = deferred()
        mockRetireLegacyGrants.mockImplementation(() => update.promise)
        const pending = startGrant(hook)
        await waitFor(() => expect(mockRetireLegacyGrants).toHaveBeenCalled())
        switchIdentity(hook, () => {
            mockUserId = 'user-b'
        })
        update.release()

        expect(await finish(pending)).toEqual({ ok: false, error: { kind: 'account-changed' } })
        expect(mockSignKernelPermission).not.toHaveBeenCalled()
        expect(mockSubmitFundingGrant).not.toHaveBeenCalled()
    })
})

describe('useRainFunding — the state the UI reads', () => {
    it('is unknown while unread and after a failed read — never "not granted"', async () => {
        mockGetCardFunding.mockRejectedValue(new ApiError('down', { status: 503 }))
        const { result } = renderHook(() => useRainFunding(), { wrapper })
        await waitFor(() => expect(result.current.fundingError).toBeTruthy())
        expect(result.current.status).toBeUndefined()
        expect(result.current.needsGrant).toBeUndefined()
    })

    it.each<[Status, boolean]>([
        ['required', true],
        ['migration_required', true],
        ['pending', false],
        ['ready', false],
        ['temporarily_unavailable', false],
    ])('a %s state needs a grant: %s', async (status, needs) => {
        mockGetCardFunding.mockResolvedValue(funding(status))
        const { result } = renderHook(() => useRainFunding(), { wrapper })
        await waitFor(() => expect(result.current.status).toBe(status))
        expect(result.current.needsGrant).toBe(needs)
        expect(result.current.isPending).toBe(status === 'pending')
        expect(result.current.isMigration).toBe(status === 'migration_required')
    })

    it('a retired permission does not need a grant even though the backend status is required', async () => {
        mockGetCardFunding.mockResolvedValue(
            funding('required', { management: { status: 'required', reason: 'scope_retired', migration: null } })
        )
        const { result } = renderHook(() => useRainFunding(), { wrapper })
        await waitFor(() => expect(result.current.status).toBe('required'))
        expect(result.current.needsGrant).toBe(false)
    })

    it('does not read anything while disabled', () => {
        renderHook(() => useRainFunding({ enabled: false }), { wrapper })
        expect(mockGetCardFunding).not.toHaveBeenCalled()
    })

    it('keeps each account’s state apart', async () => {
        mockGetCardFunding.mockResolvedValue(funding('ready'))
        const { result, rerender } = renderHook(() => useRainFunding(), { wrapper })
        await waitFor(() => expect(result.current.status).toBe('ready'))

        mockUserId = 'user-b'
        mockGetCardFunding.mockResolvedValue(funding('required'))
        rerender()
        // user-b never sees user-a's "ready"
        expect(result.current.status).not.toBe('ready')
        await waitFor(() => expect(result.current.status).toBe('required'))
    })

    it('recheck re-reads the state and drops the last error — the way out of pending', async () => {
        mockGetCardFunding.mockResolvedValue(funding('pending'))
        const { result } = renderHook(() => useRainFunding(), { wrapper })
        await waitFor(() => expect(result.current.isPending).toBe(true))

        mockGetCardFunding.mockResolvedValue(funding('ready'))
        await act(async () => {
            await result.current.recheck()
        })
        await waitFor(() => expect(result.current.status).toBe('ready'))
        expect(result.current.lastError).toBeNull()
    })

    it('keeps polling the backend while a grant is pending, and stops once it is ready', async () => {
        jest.useFakeTimers()
        try {
            mockGetCardFunding.mockResolvedValue(funding('pending'))
            const { result } = renderHook(() => useRainFunding(), { wrapper })
            await act(async () => {
                await jest.advanceTimersByTimeAsync(0)
            })
            expect(result.current.isPending).toBe(true)
            const reads = mockGetCardFunding.mock.calls.length

            mockGetCardFunding.mockResolvedValue(funding('ready'))
            await act(async () => {
                await jest.advanceTimersByTimeAsync(3_100)
            })
            expect(mockGetCardFunding.mock.calls.length).toBeGreaterThan(reads)
            expect(result.current.status).toBe('ready')

            const settled = mockGetCardFunding.mock.calls.length
            await act(async () => {
                await jest.advanceTimersByTimeAsync(10_000)
            })
            expect(mockGetCardFunding.mock.calls.length).toBe(settled)
        } finally {
            jest.useRealTimers()
        }
    })
})

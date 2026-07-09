/**
 * Regression guard for the card session-key grant binding its enable approval
 * to the WRONG kernel nonce.
 *
 * The session-key permission installs on-chain via an "enable" approval the
 * passkey signs at grant time, bound to the account's `currentNonce`. The SDK's
 * internal `getKernelV3Nonce` silently returns `1` on a read failure — minting
 * an approval frozen to nonce 1 that the kernel rejects with AA23 InvalidNonce
 * for any account whose live nonce ≠ 1 (migrated / sudo-changed accounts). The
 * card then declines forever. The fix reads `currentNonce` explicitly, binds the
 * enable to it, and throws on a read failure instead of producing a bad approval —
 * except for counterfactual (never-deployed) accounts, where the read reverting is
 * expected and 1 is exact (the kernel initializes currentNonce to 1 at deployment).
 *
 * These tests lock down that contract:
 *  1. the enable approval is bound to the live currentNonce (not a fallback),
 *  2. a failed currentNonce read on a deployed account aborts the grant, and
 *  3. counterfactual accounts still grant (nonce 1), so fresh wallets aren't blocked.
 */
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { serializePermissionAccount, toPermissionValidator } from '@zerodev/permissions'
import { toCallPolicy } from '@zerodev/permissions/policies'
import { toECDSASigner } from '@zerodev/permissions/signers'
import { peanutPublicClient } from '@/app/actions/clients'
import { useKernelClient } from '@/context/kernelClient.context'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { rainApi } from '@/services/rain'

const COLLATERAL = '0x4e5b89fd498f333ed7f2a59c5f23d5b5dc41b3de'
const COORDINATOR = '0xc0d5bd6307ec8c8da03e7502a00b8cba24eefc06'
const ACCOUNT = '0xc97fffbf8768ca90cd62fae2e313b084fe13e553'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/constants/analytics.consts', () => ({
    ANALYTICS_EVENTS: {
        CARD_SESSION_KEY_PROMPTED: 'card_session_key_prompted',
        CARD_SESSION_KEY_GRANTED: 'card_session_key_granted',
        CARD_SESSION_KEY_FAILED: 'card_session_key_failed',
    },
}))
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
}))
jest.mock('@/constants/rain.consts', () => ({
    rainCoordinatorAbi: [
        { type: 'function', name: 'withdrawAsset', inputs: [], outputs: [], stateMutability: 'nonpayable' },
    ],
}))
jest.mock('@/context/kernelClient.context', () => ({ useKernelClient: jest.fn() }))
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: jest.fn(),
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
}))
jest.mock('@/app/actions/clients', () => ({ peanutPublicClient: { readContract: jest.fn(), getCode: jest.fn() } }))
jest.mock('@/services/rain', () => ({ rainApi: { getSessionKeyAddress: jest.fn() } }))
jest.mock('@zerodev/permissions', () => ({
    toPermissionValidator: jest.fn(),
    serializePermissionAccount: jest.fn(),
}))
jest.mock('@zerodev/permissions/policies', () => ({
    toCallPolicy: jest.fn(),
    CallPolicyVersion: { V0_0_4: '0.0.4' },
    ParamCondition: { EQUAL: 0 },
}))
jest.mock('@zerodev/permissions/signers', () => ({ toECDSASigner: jest.fn() }))
// '@zerodev/sdk' and '@zerodev/sdk/constants' both resolve to the shared mock at
// src/utils/__mocks__/zerodev-sdk.ts via package.json's jest moduleNameMapper
// ('^@zerodev/sdk(.*)$'), so every export the hook needs lives there.

// These named imports resolve through the mapper to the shared mock file, so
// they are the exact jest.fn instances the hook calls — configure them per test.
// (jest.requireMock would auto-mock the mapped file into a second instance.)
import { accountMetadata, createKernelAccount, getPluginsEnableTypedData } from '@zerodev/sdk'
import { useGrantSessionKey } from '../useGrantSessionKey'

const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

let signTypedData: jest.Mock

beforeEach(() => {
    jest.clearAllMocks()
    signTypedData = jest.fn().mockResolvedValue('0xENABLESIG')
    ;(useKernelClient as jest.Mock).mockReturnValue({
        getClientForChain: () => ({
            account: { address: ACCOUNT },
        }),
        // The enable approval signs with the v0.0.3 patched validator (#2368),
        // not the client's possibly-stale kernelPluginManager.sudoValidator.
        getPatchedSudoValidator: jest.fn().mockResolvedValue({ signTypedData }),
    })
    ;(useRainCardOverview as jest.Mock).mockReturnValue({
        overview: { status: { contractAddress: COLLATERAL, coordinatorAddress: COORDINATOR }, cards: [{}] },
        refetch: jest.fn(),
    })
    ;(rainApi.getSessionKeyAddress as jest.Mock).mockResolvedValue({
        address: '0x4300F803a281e257F3C1de001512e68972f8d022',
    })
    ;(toCallPolicy as jest.Mock).mockResolvedValue({ __policy: true })
    ;(toECDSASigner as jest.Mock).mockResolvedValue({ __signer: true })
    ;(toPermissionValidator as jest.Mock).mockResolvedValue({ __permission: true })
    ;(createKernelAccount as jest.Mock).mockResolvedValue({
        address: ACCOUNT,
        kernelPluginManager: { getAction: () => ({ selector: '0xe9ae5c53', address: ACCOUNT }), hook: undefined },
    })
    ;(getPluginsEnableTypedData as jest.Mock).mockResolvedValue({ primaryType: 'Enable', message: {} })
    ;(accountMetadata as jest.Mock).mockResolvedValue({ name: 'Kernel', version: '0.3.1', chainId: 42161n })
    ;(serializePermissionAccount as jest.Mock).mockResolvedValue('SERIALIZED_APPROVAL')
    // deployed account by default; individual tests override for counterfactual
    ;(peanutPublicClient.getCode as jest.Mock).mockResolvedValue('0xdeadbeef')
})

describe('useGrantSessionKey — enable approval binds to the live currentNonce', () => {
    it('reads currentNonce and binds the enable approval to it, injecting the signature', async () => {
        ;(peanutPublicClient.readContract as jest.Mock).mockResolvedValue(2n) // migrated account, nonce advanced past 1

        const { result } = renderHook(() => useGrantSessionKey(), { wrapper })
        let out: Awaited<ReturnType<typeof result.current.serializeGrant>>
        await act(async () => {
            out = await result.current.serializeGrant()
        })

        // currentNonce was read on the account…
        expect(peanutPublicClient.readContract).toHaveBeenCalledWith(
            expect.objectContaining({ address: ACCOUNT, functionName: 'currentNonce' })
        )
        // …the enable typed data was built for THAT nonce (2), not a fallback (1),
        // over the account's live EIP-712 domain version…
        expect(getPluginsEnableTypedData).toHaveBeenCalledWith(
            expect.objectContaining({ validatorNonce: 2, kernelVersion: '0.3.1' })
        )
        // …signed by the sudo (passkey) validator, and injected into serialize.
        expect(signTypedData).toHaveBeenCalledWith({ primaryType: 'Enable', message: {} })
        expect(serializePermissionAccount).toHaveBeenCalledWith(expect.anything(), undefined, '0xENABLESIG')
        expect(out!).toEqual({ ok: true, serialized: 'SERIALIZED_APPROVAL' })
    })

    it('aborts the grant when currentNonce cannot be read on a DEPLOYED account — no approval is produced', async () => {
        ;(peanutPublicClient.readContract as jest.Mock).mockRejectedValue(new Error('RPC read failed'))

        const { result } = renderHook(() => useGrantSessionKey(), { wrapper })
        let out: Awaited<ReturnType<typeof result.current.serializeGrant>>
        await act(async () => {
            out = await result.current.serializeGrant()
        })

        // The old silent fallback would have minted a nonce-1 approval here.
        expect(getPluginsEnableTypedData).not.toHaveBeenCalled()
        expect(serializePermissionAccount).not.toHaveBeenCalled()
        expect(out!.ok).toBe(false)
    })

    it('grants with nonce 1 for a counterfactual (never-deployed) account — the read reverting is expected there', async () => {
        // No code at the address: the currentNonce read reverts, but 1 is exact
        // (the kernel initializes currentNonce to 1 at deployment), so the grant
        // must succeed rather than block card issuance for fresh wallets.
        ;(peanutPublicClient.getCode as jest.Mock).mockResolvedValue(undefined)
        ;(peanutPublicClient.readContract as jest.Mock).mockRejectedValue(new Error('returned no data ("0x")'))

        const { result } = renderHook(() => useGrantSessionKey(), { wrapper })
        let out: Awaited<ReturnType<typeof result.current.serializeGrant>>
        await act(async () => {
            out = await result.current.serializeGrant()
        })

        expect(getPluginsEnableTypedData).toHaveBeenCalledWith(expect.objectContaining({ validatorNonce: 1 }))
        expect(out!).toEqual({ ok: true, serialized: 'SERIALIZED_APPROVAL' })
    })

    it('normalizes a deployed-but-uninitialized nonce of 0 to 1, the way the SDK does', async () => {
        ;(peanutPublicClient.readContract as jest.Mock).mockResolvedValue(0n)

        const { result } = renderHook(() => useGrantSessionKey(), { wrapper })
        await act(async () => {
            await result.current.serializeGrant()
        })

        expect(getPluginsEnableTypedData).toHaveBeenCalledWith(expect.objectContaining({ validatorNonce: 1 }))
    })
})

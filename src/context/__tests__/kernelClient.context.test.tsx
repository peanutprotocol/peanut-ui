/**
 * KernelClientProvider — a failed primary-chain client build must not cost
 * the user their session unless the stored passkey is genuinely stale.
 *
 * This branch logged out 8 production users in Aug 2026 on plain RPC/bundler
 * hiccups (Sentry: "[KernelClient] Primary chain client failed after retries").
 * The provider is mounted for real here; the build is driven to rejection by
 * making the passkey validator throw, and the retry/reconnect helpers are
 * stubbed so the outcome is observable synchronously.
 */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'

const mockDispatch = jest.fn()
const mockLogoutUser = jest.fn()
const mockFetchUser = jest.fn()
const mockCaptureException = jest.fn()
const mockStopReconnect = jest.fn()
const mockToPasskeyValidator = jest.fn()
const mockUpdateUserPreferences = jest.fn()
let mockUserId = 'u1'
let mockCookieOnly = false
const mockCookieKey = {
    pubX: 1n,
    pubY: 2n,
    authenticatorId: 'cookie-key',
    authenticatorIdHash: '0x01',
    rpID: 'localhost',
}
let mockAccounts: Array<{ type: string; identifier: string }> = []
let mockReconnectCallback: (() => void) | undefined

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: {
            user: { userId: mockUserId, username: 'alice', createdAt: '2026-01-01T00:00:00.000Z' },
            accounts: mockAccounts,
        },
        logoutUser: mockLogoutUser,
        fetchUser: mockFetchUser,
    }),
}))
jest.mock('@/hooks/useZeroDevFlow', () => ({
    useZeroDevFlow: () => ({
        isKernelClientReady: false,
        isRegistering: false,
        isLoggingIn: false,
        isSendingUserOp: false,
        address: undefined,
    }),
    zeroDevFlowActions: {
        reset: () => mockDispatch({ type: 'zerodev/reset' }),
        setIsRegistering: (payload: boolean) => mockDispatch({ type: 'zerodev/registering', payload }),
        setIsLoggingIn: (payload: boolean) => mockDispatch({ type: 'zerodev/logging-in', payload }),
        setIsKernelClientReady: (payload: boolean) => mockDispatch({ type: 'zerodev/ready', payload }),
        setIsSendingUserOp: (payload: boolean) => mockDispatch({ type: 'zerodev/sending', payload }),
        setAddress: (payload: string | undefined) => mockDispatch({ type: 'zerodev/address', payload }),
    },
}))
jest.mock('@/utils/general.utils', () => ({
    getFromCookie: () => (mockCookieOnly ? mockCookieKey : null),
    getUserPreferences: (userId: string) =>
        mockCookieOnly
            ? {}
            : {
                  webAuthnKey: {
                      pubX: 1n,
                      pubY: 2n,
                      authenticatorId: userId === 'u1' ? 'auth-1' : 'auth-2',
                      authenticatorIdHash: '0x01',
                      rpID: 'localhost',
                  },
              },
    updateUserPreferences: (...args: unknown[]) => mockUpdateUserPreferences(...args),
}))
jest.mock('@zerodev/passkey-validator', () => ({
    PasskeyValidatorContractVersion: { V0_0_2: 'V0_0_2', V0_0_3_PATCHED: 'V0_0_3_PATCHED' },
    toPasskeyValidator: (...args: unknown[]) => mockToPasskeyValidator(...args),
    toWebAuthnKey: jest.fn(),
}))
jest.mock('@zerodev/sdk', () => ({
    createKernelAccount: jest.fn(),
    createKernelAccountClient: jest.fn(),
    createZeroDevPaymasterClient: jest.fn(),
    createKernelMigrationAccount: jest.fn(),
    getEntryPoint: () => ({ address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032', version: '0.7' }),
    KERNEL_V3_1: '0.3.1',
}))
jest.mock('@zerodev/ecdsa-validator', () => ({ signerToEcdsaValidator: jest.fn() }))
jest.mock('@/constants/zerodev.consts', () => ({
    ...jest.requireActual('@/constants/zerodev.consts'),
    assertZeroDevRpcUrls: jest.fn(),
    assertZeroDevBundlerUrl: jest.fn(),
}))
jest.mock('@/app/actions/clients', () => {
    const { PEANUT_WALLET_CHAIN } = jest.requireActual('@/constants/zerodev.consts')
    return {
        PUBLIC_CLIENTS_BY_CHAIN: {
            [PEANUT_WALLET_CHAIN.id]: {
                client: {},
                chain: PEANUT_WALLET_CHAIN,
                bundlerUrl: 'https://bundler.test',
                paymasterUrl: 'https://paymaster.test',
            },
        },
    }
})
jest.mock('@/utils/retry.utils', () => ({ retryAsync: (fn: () => Promise<unknown>) => fn() }))
jest.mock('@/utils/reconnect.utils', () => ({
    onReconnect: (cb: () => void) => {
        mockReconnectCallback = cb
        return mockStopReconnect
    },
}))
jest.mock('@sentry/nextjs', () => ({
    captureException: (...args: unknown[]) => mockCaptureException(...args),
    captureMessage: jest.fn(),
}))
jest.mock('@/utils/capacitor', () => ({
    isAndroidNative: () => false,
    isCapacitor: () => false,
    getNativeRpId: () => 'localhost',
}))
jest.mock('@/utils/native-webauthn', () => ({ createNativeSignMessageCallback: jest.fn() }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
jest.mock('@/dev/fixtures/active', () => ({ ensureActiveFixture: () => null }))
jest.mock('@/constants/harness.consts', () => ({ HARNESS_ENABLED: false }))

import { KernelClientProvider, useKernelClient } from '../kernelClient.context'

const renderProvider = () =>
    render(
        <KernelClientProvider>
            <div />
        </KernelClientProvider>
    )

beforeEach(() => {
    jest.clearAllMocks()
    mockReconnectCallback = undefined
    mockAccounts = []
    mockUserId = 'u1'
    mockCookieOnly = false
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
    jest.restoreAllMocks()
})

describe('KernelClientProvider — primary client build failure', () => {
    it('keeps the session on a transient RPC failure and rebuilds once the device reconnects', async () => {
        mockToPasskeyValidator.mockRejectedValue(new Error('fetch failed: bundler unreachable'))

        renderProvider()
        await waitFor(() => expect(mockCaptureException).toHaveBeenCalled())

        expect(mockLogoutUser).not.toHaveBeenCalled()
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'zerodev/ready', payload: false })
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'zerodev/registering', payload: false })
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'zerodev/logging-in', payload: false })
        expect(mockReconnectCallback).toBeDefined()

        const buildsBefore = mockToPasskeyValidator.mock.calls.length
        act(() => mockReconnectCallback!())
        await waitFor(() => expect(mockToPasskeyValidator.mock.calls.length).toBeGreaterThan(buildsBefore))
        expect(mockLogoutUser).not.toHaveBeenCalled()
    })

    it('still forces a logout when the stored key is stale, and purges the rejected credential', async () => {
        mockToPasskeyValidator.mockRejectedValue(new Error('UserOperation reverted: AA24 signature error'))

        renderProvider()
        await waitFor(() => expect(mockLogoutUser).toHaveBeenCalledTimes(1))

        // Preferences outlive the logout, so leaving the rejected key behind
        // would re-pair the account with it on the next restore.
        expect(mockUpdateUserPreferences).toHaveBeenCalledWith('u1', { webAuthnKey: undefined })
        expect(mockReconnectCallback).toBeUndefined()
        expect(mockCaptureException).not.toHaveBeenCalled()
    })

    it('an unmount before the build settles neither logs out nor arms a reconnect', async () => {
        let rejectBuild!: (error: Error) => void
        mockToPasskeyValidator.mockImplementation(
            () =>
                new Promise((_, reject) => {
                    rejectBuild = reject
                })
        )

        const { unmount } = renderProvider()
        await waitFor(() => expect(mockToPasskeyValidator).toHaveBeenCalled())
        unmount()

        await act(async () => {
            rejectBuild(new Error('fetch failed: bundler unreachable'))
            await Promise.resolve()
        })

        expect(mockLogoutUser).not.toHaveBeenCalled()
        expect(mockReconnectCallback).toBeUndefined()
        expect(mockCaptureException).not.toHaveBeenCalled()
    })
})

// A successful but obsolete build must not invalidate a newer session.
it('ignores a mismatched primary build that resolves after its effect is disposed', async () => {
    const { createKernelAccountClient } = jest.requireMock('@zerodev/sdk')
    mockAccounts = [{ type: 'peanut-wallet', identifier: '0x1111111111111111111111111111111111111111' }]
    let resolveValidator!: (value: object) => void
    mockToPasskeyValidator.mockImplementation(
        () =>
            new Promise((resolve) => {
                resolveValidator = resolve
            })
    )
    createKernelAccountClient.mockReturnValue({
        account: { address: '0x2222222222222222222222222222222222222222' },
        sendUserOperation: jest.fn(),
    })
    const { unmount } = renderProvider()
    await waitFor(() => expect(mockToPasskeyValidator).toHaveBeenCalled())
    unmount()
    await act(async () => {
        resolveValidator({})
        await Promise.resolve()
    })
    expect(mockLogoutUser).not.toHaveBeenCalled()
    expect(mockUpdateUserPreferences).not.toHaveBeenCalledWith('u1', { webAuthnKey: undefined })
})

it('keeps a completed rebuild when the older primary initialization settles last', async () => {
    const sdk = jest.requireMock('@zerodev/sdk')
    sdk.createKernelAccount.mockImplementation(
        (_client: unknown, options: { plugins: { sudo: { address: string } } }) => ({
            address: options.plugins.sudo.address,
        })
    )
    sdk.createKernelAccountClient.mockImplementation(({ account }: { account: object }) => ({
        account,
        sendUserOperation: jest.fn(),
    }))
    let resolveOld!: (value: object) => void
    mockToPasskeyValidator
        .mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveOld = resolve
                })
        )
        .mockResolvedValue({ address: '0x2222222222222222222222222222222222222222' })
    let context!: ReturnType<typeof useKernelClient>
    function Probe() {
        context = useKernelClient()
        return null
    }
    render(
        <KernelClientProvider>
            <Probe />
        </KernelClientProvider>
    )
    await waitFor(() => expect(mockToPasskeyValidator).toHaveBeenCalledTimes(1))
    const { PEANUT_WALLET_CHAIN } = jest.requireActual('@/constants/zerodev.consts')
    const chainId = String(PEANUT_WALLET_CHAIN.id)
    await act(async () => {
        await context.rebuildClientForChain(chainId)
    })
    await act(async () => {
        resolveOld({ address: '0x1111111111111111111111111111111111111111' })
        await Promise.resolve()
    })
    expect(context.getClientForChain(chainId).account?.address).toBe('0x2222222222222222222222222222222222222222')
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'zerodev/ready', payload: true })
    expect(mockLogoutUser).not.toHaveBeenCalled()
})

it('stops handing out the previous credential client while a new credential initializes', async () => {
    const sdk = jest.requireMock('@zerodev/sdk')
    sdk.createKernelAccount.mockImplementation(
        (_client: unknown, options: { plugins: { sudo: { address: string } } }) => ({
            address: options.plugins.sudo.address,
        })
    )
    sdk.createKernelAccountClient.mockImplementation(({ account }: { account: object }) => ({
        account,
        sendUserOperation: jest.fn(),
    }))
    mockToPasskeyValidator.mockResolvedValue({ address: '0x1111111111111111111111111111111111111111' })
    let context!: ReturnType<typeof useKernelClient>
    function Probe() {
        context = useKernelClient()
        return null
    }
    render(
        <KernelClientProvider>
            <Probe />
        </KernelClientProvider>
    )
    const { PEANUT_WALLET_CHAIN } = jest.requireActual('@/constants/zerodev.consts')
    const chainId = String(PEANUT_WALLET_CHAIN.id)
    await waitFor(() =>
        expect(context.getClientForChain(chainId).account?.address).toBe('0x1111111111111111111111111111111111111111')
    )
    let resolveNew!: (value: object) => void
    mockToPasskeyValidator.mockImplementation(
        () =>
            new Promise((resolve) => {
                resolveNew = resolve
            })
    )
    act(() =>
        context.setWebAuthnKey({
            pubX: 3n,
            pubY: 4n,
            authenticatorId: 'auth-2',
            authenticatorIdHash: '0x02',
            rpID: 'localhost',
        } as Parameters<typeof context.setWebAuthnKey>[0])
    )
    expect(() => context.getClientForChain(chainId)).toThrow('No client found')
    let pending!: ReturnType<typeof context.ensureClientForChain>
    act(() => {
        pending = context.ensureClientForChain(chainId)
    })
    await act(async () => {
        resolveNew({ address: '0x2222222222222222222222222222222222222222' })
        await pending
    })
    expect(context.getClientForChain(chainId).account?.address).toBe('0x2222222222222222222222222222222222222222')
})

it('never persists the previous account credential under a newly active user', async () => {
    mockToPasskeyValidator.mockRejectedValue(new Error('offline'))
    const view = renderProvider()
    await waitFor(() => expect(mockToPasskeyValidator).toHaveBeenCalled())
    mockUpdateUserPreferences.mockClear()
    mockUserId = 'u2'
    view.rerender(
        <KernelClientProvider>
            <div />
        </KernelClientProvider>
    )
    await waitFor(() =>
        expect(mockToPasskeyValidator).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                webAuthnKey: expect.objectContaining({ authenticatorId: 'auth-2' }),
            })
        )
    )
    expect(mockUpdateUserPreferences).not.toHaveBeenCalledWith(
        'u2',
        expect.objectContaining({
            webAuthnKey: expect.objectContaining({ authenticatorId: 'auth-1' }),
        })
    )
})

it('persists the new account key after success and ignores the old account build finishing last', async () => {
    const sdk = jest.requireMock('@zerodev/sdk')
    sdk.createKernelAccount.mockImplementation(
        (_client: unknown, options: { plugins: { sudo: { address: string } } }) => ({
            address: options.plugins.sudo.address,
        })
    )
    sdk.createKernelAccountClient.mockImplementation(({ account }: { account: object }) => ({
        account,
        sendUserOperation: jest.fn(),
    }))
    let resolveOld!: (value: object) => void
    mockToPasskeyValidator
        .mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveOld = resolve
                })
        )
        .mockResolvedValue({ address: '0x2222222222222222222222222222222222222222' })
    const view = renderProvider()
    await waitFor(() => expect(mockToPasskeyValidator).toHaveBeenCalled())
    mockUserId = 'u2'
    view.rerender(
        <KernelClientProvider>
            <div />
        </KernelClientProvider>
    )
    await waitFor(() =>
        expect(mockUpdateUserPreferences).toHaveBeenCalledWith('u2', {
            webAuthnKey: expect.objectContaining({ authenticatorId: 'auth-2' }),
        })
    )
    await act(async () => {
        resolveOld({ address: '0x1111111111111111111111111111111111111111' })
    })
    expect(mockUpdateUserPreferences).not.toHaveBeenCalledWith('u2', {
        webAuthnKey: expect.objectContaining({ authenticatorId: 'auth-1' }),
    })
    expect(mockUpdateUserPreferences).not.toHaveBeenCalledWith('u1', expect.anything())
})

it.each([true, false])(
    'a cookie-only key is persisted only after wallet ownership is checked (matches=%s)',
    async (matches) => {
        mockCookieOnly = true
        mockAccounts = [{ type: 'peanut-wallet', identifier: '0x1111111111111111111111111111111111111111' }]
        mockToPasskeyValidator.mockRejectedValue(new Error('offline'))
        renderProvider()
        await waitFor(() => expect(mockReconnectCallback).toBeDefined())
        expect(mockUpdateUserPreferences).not.toHaveBeenCalled()
        expect(mockLogoutUser).not.toHaveBeenCalled()

        const sdk = jest.requireMock('@zerodev/sdk')
        mockToPasskeyValidator.mockResolvedValue({})
        sdk.createKernelAccount.mockResolvedValue({
            address: matches
                ? '0x1111111111111111111111111111111111111111'
                : '0x2222222222222222222222222222222222222222',
        })
        sdk.createKernelAccountClient.mockImplementation(({ account }: { account: object }) => ({
            account,
            sendUserOperation: jest.fn(),
        }))
        act(() => mockReconnectCallback!())
        if (matches) {
            await waitFor(() =>
                expect(mockUpdateUserPreferences).toHaveBeenCalledWith('u1', { webAuthnKey: mockCookieKey })
            )
            expect(mockLogoutUser).not.toHaveBeenCalled()
        } else {
            await waitFor(() => expect(mockLogoutUser).toHaveBeenCalledTimes(1))
            expect(mockUpdateUserPreferences).not.toHaveBeenCalledWith('u1', { webAuthnKey: mockCookieKey })
            expect(mockUpdateUserPreferences).toHaveBeenCalledWith('u1', { webAuthnKey: undefined })
        }
    }
)

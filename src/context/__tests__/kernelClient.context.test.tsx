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
let mockReconnectCallback: (() => void) | undefined

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: { user: { userId: 'u1', username: 'alice', createdAt: '2026-01-01T00:00:00.000Z' }, accounts: [] },
        logoutUser: mockLogoutUser,
        fetchUser: mockFetchUser,
    }),
}))
jest.mock('@/redux/hooks', () => ({ useAppDispatch: () => mockDispatch }))
jest.mock('@/redux/slices/zerodev-slice', () => ({
    zerodevActions: {
        setIsRegistering: (payload: boolean) => ({ type: 'zerodev/registering', payload }),
        setIsLoggingIn: (payload: boolean) => ({ type: 'zerodev/logging-in', payload }),
        setIsKernelClientReady: (payload: boolean) => ({ type: 'zerodev/ready', payload }),
        setAddress: (payload: string) => ({ type: 'zerodev/address', payload }),
        resetZeroDevState: () => ({ type: 'zerodev/reset' }),
    },
}))
jest.mock('@/utils/general.utils', () => ({
    getFromCookie: () => null,
    getUserPreferences: () => ({
        webAuthnKey: { pubX: 1n, pubY: 2n, authenticatorId: 'auth-1', authenticatorIdHash: '0x01', rpID: 'localhost' },
    }),
    updateUserPreferences: jest.fn(),
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
}))
jest.mock('@zerodev/sdk/accounts', () => ({ createKernelMigrationAccount: jest.fn() }))
jest.mock('@zerodev/sdk/constants', () => ({
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

import { KernelClientProvider } from '../kernelClient.context'

const renderProvider = () =>
    render(
        <KernelClientProvider>
            <div />
        </KernelClientProvider>
    )

beforeEach(() => {
    jest.clearAllMocks()
    mockReconnectCallback = undefined
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

    it('still forces a logout when the stored key is stale', async () => {
        mockToPasskeyValidator.mockRejectedValue(new Error('UserOperation reverted: AA24 signature error'))

        renderProvider()
        await waitFor(() => expect(mockLogoutUser).toHaveBeenCalledTimes(1))

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

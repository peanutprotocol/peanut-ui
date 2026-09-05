import { act, renderHook } from '@testing-library/react'
import { useZeroDev } from '../useZeroDev'
import { removeFromCookie } from '@/utils/general.utils'
import { CeremonyConflictError } from '@/utils/passkeyCeremony.utils'

const mockDispatch = jest.fn()
const mockCaptureException = jest.fn()
const mockToWebAuthnKey = jest.fn()
let mockActiveCeremonyId: number | null = null

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'u1', username: 'alice' } }, logoutUser: jest.fn() }),
}))
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({
        setWebAuthnKey: jest.fn(),
        getClientForChain: jest.fn(),
        ensureClientForChain: jest.fn(),
    }),
}))
jest.mock('@/context/loadingStates.context', () => {
    const React = jest.requireActual<typeof import('react')>('react')
    return { loadingStateContext: React.createContext({ setLoadingState: jest.fn() }) }
})
jest.mock('@/redux/hooks', () => ({
    useAppDispatch: () => mockDispatch,
    useSetupStore: () => ({ inviteCode: '', inviteType: undefined }),
    useZerodevStore: () => ({
        isKernelClientReady: true,
        isRegistering: false,
        isLoggingIn: false,
        isSendingUserOp: false,
        address: undefined,
    }),
}))
jest.mock('@/redux/slices/zerodev-slice', () => ({
    zerodevActions: {
        resetZeroDevState: () => ({ type: 'zerodev/reset' }),
        setIsRegistering: (payload: boolean) => ({ type: 'zerodev/registering', payload }),
        setIsLoggingIn: (payload: boolean) => ({ type: 'zerodev/logging-in', payload }),
        setIsSendingUserOp: (payload: boolean) => ({ type: 'zerodev/sending', payload }),
        setAddress: (payload: string) => ({ type: 'zerodev/address', payload }),
    },
}))
jest.mock('@/redux/slices/setup-slice', () => ({
    setupActions: { setInviteCode: (payload: string) => ({ type: 'setup/invite-code', payload }) },
}))
jest.mock('@/utils/general.utils', () => ({
    getFromCookie: () => null,
    removeFromCookie: jest.fn(),
    saveToCookie: jest.fn(),
    saveToLocalStorage: jest.fn(),
}))
jest.mock('@zerodev/passkey-validator', () => ({
    toWebAuthnKey: (...args: unknown[]) => mockToWebAuthnKey(...args),
    WebAuthnMode: { Register: 'Register', Login: 'Login' },
}))
jest.mock('@/services/invites', () => ({ invitesApi: { acceptInvite: jest.fn() } }))
jest.mock('@/services/invite-acquisition', () => ({ settleAcceptedInviteAcquisition: jest.fn() }))
jest.mock('@/app/shhhhh/shhhhh-acquisition', () => ({ settleShhhhhCampaignContinuation: jest.fn() }))
jest.mock('@/components/Invites/badge-campaign-context', () => ({ getPendingBadgeCampaigns: () => [] }))
jest.mock('@/services/badge-campaigns', () => ({
    claimAndSettlePendingBadgeCampaigns: jest.fn(),
    isConfirmedBadgeCampaignClaim: jest.fn(),
    isUnavailableBadgeCampaignClaim: jest.fn(),
}))
jest.mock('@/services/consent', () => ({ signupConsentDocuments: () => [] }))
jest.mock('@/utils/auth.utils', () => ({ clearAuthState: jest.fn() }))
// Only `currentCeremonyId` is stubbed: the guard's own module-level window
// stays real, so a test that does NOT claim a ceremony still runs one for real.
jest.mock('@/utils/passkeyCeremony.utils', () => ({
    ...jest.requireActual('@/utils/passkeyCeremony.utils'),
    currentCeremonyId: () => mockActiveCeremonyId,
}))
jest.mock('@/utils/walletCredential.utils', () => ({
    isStaleKeyError: () => false,
    createStaleSessionError: () => new Error('stale'),
}))
jest.mock('@sentry/nextjs', () => ({
    captureException: (...args: unknown[]) => mockCaptureException(...args),
    captureMessage: jest.fn(),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false, getNativeRpId: () => 'localhost' }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))

/*
 * PEANUT-UI-T09. The component latch (SetupPasskey.test.tsx) is not the
 * backstop: the help modal's retry re-enters the hook, and a losing tap used to
 * run handleRegister's prologue in full — wiping the passkey cookie and the
 * redux address that the ceremony already on screen was about to fill, then
 * releasing that ceremony's isRegistering flag. Both rules live in useZeroDev,
 * so both are pinned here.
 */
describe('useZeroDev — a losing ceremony touches nothing the winner owns', () => {
    let errorSpy: jest.SpyInstance

    beforeEach(() => {
        jest.clearAllMocks()
        mockActiveCeremonyId = null
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => errorSpy.mockRestore())

    const runCatching = async (call: (hook: ReturnType<typeof useZeroDev>) => Promise<unknown>) => {
        const { result } = renderHook(() => useZeroDev())
        let thrown: unknown
        await act(async () => {
            try {
                await call(result.current)
            } catch (e) {
                thrown = e
            }
        })
        return thrown as Error & { code?: string }
    }

    it('rejects a registration that races an active ceremony before destroying any state', async () => {
        mockActiveCeremonyId = 7

        const thrown = await runCatching((hook) => hook.handleRegister('alice'))

        expect(thrown.name).toBe('CeremonyConflictError')
        // the ordering IS the fix — the bail must precede the prologue
        expect(removeFromCookie).not.toHaveBeenCalled()
        expect(mockDispatch).not.toHaveBeenCalledWith({ type: 'zerodev/reset' })
        expect(mockToWebAuthnKey).not.toHaveBeenCalled()
        // the flag belongs to the ceremony already on screen
        expect(mockDispatch).not.toHaveBeenCalledWith({ type: 'zerodev/registering', payload: false })
    })

    it('still clears isRegistering when the registration itself fails', async () => {
        mockToWebAuthnKey.mockRejectedValue(Object.assign(new Error('nope'), { name: 'NotAllowedError' }))

        const thrown = await runCatching((hook) => hook.handleRegister('alice'))

        expect(thrown.name).toBe('NotAllowedError')
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'zerodev/registering', payload: false })
    })

    it('leaves isLoggingIn alone when a login loses the ceremony window', async () => {
        mockToWebAuthnKey.mockRejectedValue(new CeremonyConflictError())

        const thrown = await runCatching((hook) => hook.handleLogin())

        expect(thrown.name).toBe('PasskeyError')
        expect(thrown.code).toBe('PASSKEY_INTERRUPTED')
        expect(mockDispatch).not.toHaveBeenCalledWith({ type: 'zerodev/logging-in', payload: false })
    })

    it('still clears isLoggingIn for an ordinary login failure', async () => {
        mockToWebAuthnKey.mockRejectedValue(Object.assign(new Error('cancelled'), { name: 'NotAllowedError' }))

        await runCatching((hook) => hook.handleLogin())

        expect(mockDispatch).toHaveBeenCalledWith({ type: 'zerodev/logging-in', payload: false })
    })
})

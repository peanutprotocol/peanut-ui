import { renderHook, waitFor } from '@testing-library/react'
import { useWalletProvisioningLifecycle } from '../useWalletProvisioningLifecycle'
import { isIOSNative } from '@/utils/capacitor'
import {
    clearLegacyWalletSessionForWallet,
    clearWalletAuthorizationToken,
    clearWalletCardForWallet,
} from '@/utils/push-provisioning'

const mockedFlag = jest.fn()

jest.mock('@/hooks/useFeatureFlag', () => ({ useFeatureFlags: () => mockedFlag }))
jest.mock('@/utils/capacitor', () => ({ isIOSNative: jest.fn() }))
jest.mock('@/utils/push-provisioning', () => ({
    clearLegacyWalletSessionForWallet: jest.fn(),
    clearWalletAuthorizationToken: jest.fn(),
    clearWalletCardForWallet: jest.fn(),
    PUSH_PROVISIONING_FLAG: 'push-provisioning',
}))

const mockedIsIOS = isIOSNative as jest.MockedFunction<typeof isIOSNative>
const mockedClearLegacy = clearLegacyWalletSessionForWallet as jest.MockedFunction<
    typeof clearLegacyWalletSessionForWallet
>
const mockedClearAuthorization = clearWalletAuthorizationToken as jest.MockedFunction<
    typeof clearWalletAuthorizationToken
>
const mockedClearCard = clearWalletCardForWallet as jest.MockedFunction<typeof clearWalletCardForWallet>

describe('useWalletProvisioningLifecycle', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockedIsIOS.mockReturnValue(true)
        mockedFlag.mockReturnValue(false)
    })

    it('clears legacy sessions and disabled rollout state globally', async () => {
        renderHook(() => useWalletProvisioningLifecycle())
        await waitFor(() => expect(mockedClearAuthorization).toHaveBeenCalled())
        expect(mockedClearLegacy).toHaveBeenCalledTimes(1)
        expect(mockedClearCard).toHaveBeenCalledTimes(1)
    })

    it('does not touch native Wallet state on web', async () => {
        mockedIsIOS.mockReturnValue(false)
        renderHook(() => useWalletProvisioningLifecycle())
        await Promise.resolve()
        expect(mockedClearLegacy).not.toHaveBeenCalled()
        expect(mockedClearAuthorization).not.toHaveBeenCalled()
        expect(mockedClearCard).not.toHaveBeenCalled()
    })

    it('keeps card state when the rollout is enabled', async () => {
        mockedFlag.mockReturnValue(true)
        renderHook(() => useWalletProvisioningLifecycle())
        await waitFor(() => expect(mockedClearLegacy).toHaveBeenCalled())
        expect(mockedClearAuthorization).not.toHaveBeenCalled()
        expect(mockedClearCard).not.toHaveBeenCalled()
    })
})

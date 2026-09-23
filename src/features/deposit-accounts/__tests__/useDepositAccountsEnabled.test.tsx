import { renderHook } from '@testing-library/react'
import { useAuth } from '@/context/authContext'
import { useDepositAccountsEnabled } from '../useDepositAccountsEnabled'

jest.mock('@/context/authContext', () => ({
    useAuth: jest.fn(),
}))

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

function mockUser(user: unknown) {
    mockUseAuth.mockReturnValue({ user } as unknown as ReturnType<typeof useAuth>)
}

describe('useDepositAccountsEnabled', () => {
    afterEach(() => jest.resetAllMocks())

    it('is on when the API reports the rollout open for this user', () => {
        mockUser({ depositAccounts: { enabled: true } })
        expect(renderHook(() => useDepositAccountsEnabled()).result.current).toBe(true)
    })

    it('is off when the API reports the rollout closed', () => {
        mockUser({ depositAccounts: { enabled: false } })
        expect(renderHook(() => useDepositAccountsEnabled()).result.current).toBe(false)
    })

    it('fails closed on an API that predates the field', () => {
        mockUser({ capabilities: { rails: [], nextActions: [], restrictions: [] } })
        expect(renderHook(() => useDepositAccountsEnabled()).result.current).toBe(false)
    })

    it('fails closed while there is no user', () => {
        mockUser(null)
        expect(renderHook(() => useDepositAccountsEnabled()).result.current).toBe(false)
    })
})
